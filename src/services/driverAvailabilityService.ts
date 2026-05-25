import { DatabaseService } from "../config/database";
import { emitToAdmins } from "../config/socketService";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import {
	computeAvailabilityUi,
	hasReachedAvailabilityDeadline,
	type AvailabilityPhaseContext,
	type DriverAvailabilityConfig,
} from "../utils/driverAvailability";
import { parseLocalYmd, getLocalDateOnly } from "../utils/recurringPlan";
import {
	getLocalDayRange,
	phaseDriverScheduledDateWhere,
} from "../utils/routeDayScope";
import { notificationService } from "./notificationService";

const db = DatabaseService.getInstance().getPrisma();

const DEFAULT_ADMIN_OVERRIDE_MINUTES = 10;

export class DriverAvailabilityService {
	async getAdminUserIds(): Promise<number[]> {
		const users = await db.user.findMany({
			where: { role: { is_admin_role: true } },
			select: { id: true },
		});
		return users.map((u) => u.id);
	}

	async findNextPickupPhaseForDriver(
		driverId: number,
	): Promise<AvailabilityPhaseContext | null> {
		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				driver_id: driverId,
				phase: "PICKUP",
				status: { not: "COMPLETED" },
				scheduled_date: phaseDriverScheduledDateWhere(),
				trip_start_time: { not: null },
			},
			select: {
				id: true,
				route_daily_plan_id: true,
				phase: true,
				trip_start_time: true,
				availability_missed_at: true,
				availability_miss_notified_at: true,
				availability_admin_override_until: true,
			},
			orderBy: [{ trip_start_time: "asc" }, { id: "asc" }],
		});

		const pickup = rows.find((r) => r.trip_start_time?.trim());
		if (!pickup?.trip_start_time) return null;

		return {
			phase_driver_id: pickup.id,
			route_daily_plan_id: pickup.route_daily_plan_id,
			phase: "PICKUP",
			trip_start_time: pickup.trip_start_time.trim(),
			availability_missed_at: pickup.availability_missed_at,
			availability_miss_notified_at: pickup.availability_miss_notified_at,
			availability_admin_override_until:
				pickup.availability_admin_override_until,
		};
	}

	buildAvailabilityPayload(
		driver: {
			id: number;
			is_available: boolean;
			available_at: Date | null;
		},
		config: DriverAvailabilityConfig,
		nextPickup: AvailabilityPhaseContext | null,
	) {
		const availability_ui = computeAvailabilityUi({
			is_available: driver.is_available,
			config,
			nextPickup,
		});

		return {
			driver: {
				id: driver.id,
				is_available: driver.is_available,
				available_at: driver.available_at,
			},
			config: {
				availability_time: config.availability_time,
				remaining_start_time: config.remaining_start_time,
			},
			availability_ui,
		};
	}

	/** Mark missed + notify admins when deadline passed and driver still unavailable. */
	async processMissedAvailabilityForDriver(
		driverId: number,
		config: DriverAvailabilityConfig,
	): Promise<void> {
		const driver = await db.driver.findUnique({
			where: { id: driverId },
			select: { id: true, name: true, is_available: true },
		});
		if (!driver || driver.is_available) return;

		const phase = await this.findNextPickupPhaseForDriver(driverId);
		if (!phase?.trip_start_time) return;

		if (phase.availability_miss_notified_at) return;

		if (
			!hasReachedAvailabilityDeadline(
				phase.trip_start_time,
				config.availability_time,
			)
		) {
			return;
		}

		const now = new Date();
		await db.routeDailyPlanPhaseDriver.update({
			where: { id: phase.phase_driver_id },
			data: {
				availability_missed_at: phase.availability_missed_at ?? now,
				availability_miss_notified_at: now,
			},
		});

		await this.notifyAdminsDriverMissedAvailability({
			driverId: driver.id,
			driverName: driver.name,
			phaseDriverId: phase.phase_driver_id,
			routeDailyPlanId: phase.route_daily_plan_id,
			tripStartTime: phase.trip_start_time,
			missedAt: now,
		});
	}

	async processAllMissedAvailability(): Promise<number> {
		const config = await db.driverConfiguration.findFirst();
		if (!config) return 0;

		const phases = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				phase: "PICKUP",
				status: { not: "COMPLETED" },
				scheduled_date: phaseDriverScheduledDateWhere(),
				trip_start_time: { not: null },
				availability_miss_notified_at: null,
				driver: { is_available: false },
			},
			select: {
				id: true,
				driver_id: true,
				trip_start_time: true,
			},
		});

		let notified = 0;
		for (const row of phases) {
			if (!row.trip_start_time?.trim()) continue;
			if (
				!hasReachedAvailabilityDeadline(
					row.trip_start_time,
					config.availability_time,
				)
			) {
				continue;
			}
			await this.processMissedAvailabilityForDriver(row.driver_id, config);
			notified += 1;
		}
		return notified;
	}

	async notifyAdminsDriverMissedAvailability(payload: {
		driverId: number;
		driverName: string;
		phaseDriverId: number;
		routeDailyPlanId: number;
		tripStartTime: string;
		missedAt: Date;
	}) {
		const eventPayload = {
			type: "driver_availability_missed",
			driverId: payload.driverId,
			driverName: payload.driverName,
			phase_driver_id: payload.phaseDriverId,
			route_daily_plan_id: payload.routeDailyPlanId,
			trip_start_time: payload.tripStartTime,
			missed_at: payload.missedAt.toISOString(),
		};

		emitToAdmins("driver:availability_missed", eventPayload);

		const adminUserIds = await this.getAdminUserIds();
		if (adminUserIds.length > 0) {
			void notificationService.sendToUsers(adminUserIds, {
				title: "Driver availability missed",
				body: `${payload.driverName} did not mark available before ${payload.tripStartTime} trip deadline`,
				data: {
					type: "driver_availability_missed",
					driverId: String(payload.driverId),
					phase_driver_id: String(payload.phaseDriverId),
					route_daily_plan_id: String(payload.routeDailyPlanId),
					trip_start_time: payload.tripStartTime,
				},
			});
		}
	}

	assertCanMarkAvailable(
		ui: ReturnType<typeof computeAvailabilityUi>,
	): void {
		if (ui.can_mark_available) return;
		if (ui.status === "ALREADY_AVAILABLE") {
			throw ResponseHandler.badRequest("Driver is already available");
		}
		if (ui.status === "DEADLINE_PASSED") {
			const by = ui.must_mark_available_before;
			throw ResponseHandler.badRequest(
				by
					? `Availability must be marked before ${by} — deadline passed. Contact admin for override.`
					: "Availability deadline passed — contact admin for override",
			);
		}
		throw ResponseHandler.badRequest("Cannot mark available for this trip");
	}

	async grantAdminOverride(
		driverId: number,
		phaseDriverId: number,
		durationMinutes = DEFAULT_ADMIN_OVERRIDE_MINUTES,
	) {
		const phase = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				id: phaseDriverId,
				driver_id: driverId,
				phase: "PICKUP",
			},
			include: {
				driver: { select: { id: true, name: true, is_available: true } },
			},
		});
		if (!phase) {
			throw ResponseHandler.notFound(
				"Pickup phase not found for this driver",
			);
		}

		const until = new Date(Date.now() + durationMinutes * 60 * 1000);
		const updated = await db.routeDailyPlanPhaseDriver.update({
			where: { id: phaseDriverId },
			data: { availability_admin_override_until: until },
		});

		return {
			driver_id: phase.driver_id,
			driver_name: phase.driver.name,
			phase_driver_id: updated.id,
			availability_admin_override_until: until.toISOString(),
			override_duration_minutes: durationMinutes,
		};
	}

	async listMissedForDate(dateStr?: string) {
		const config = await db.driverConfiguration.findFirst();
		if (!config) {
			throw ResponseHandler.notFound("Driver configuration not found");
		}

		const forDay = dateStr?.trim()
			? parseLocalYmd(dateStr.trim())
			: getLocalDateOnly(new Date());
		const { start, end } = getLocalDayRange(forDay);

		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				phase: "PICKUP",
				scheduled_date: { gte: start, lt: end },
				availability_missed_at: { not: null },
			},
			include: {
				driver: { select: { id: true, name: true, phone_no: true, is_available: true } },
				route_daily_plan: {
					select: {
						id: true,
						status: true,
						definition_route: {
							select: { company: { select: { id: true, name: true } } },
						},
					},
				},
			},
			orderBy: [{ availability_missed_at: "desc" }, { id: "desc" }],
		});

		return {
			date: dateStr ?? forDay.toISOString().slice(0, 10),
			rows: rows.map((r) => ({
				phase_driver_id: r.id,
				driver_id: r.driver_id,
				driver_name: r.driver.name,
				driver_phone_no: r.driver.phone_no,
				is_available: r.driver.is_available,
				trip_start_time: r.trip_start_time,
				availability_missed_at: r.availability_missed_at,
				availability_miss_notified_at: r.availability_miss_notified_at,
				availability_admin_override_until: r.availability_admin_override_until,
				route_daily_plan_id: r.route_daily_plan_id,
				plan_status: r.route_daily_plan.status,
				company_name: r.route_daily_plan.definition_route.company.name,
			})),
		};
	}
}

export const driverAvailabilityService = new DriverAvailabilityService();

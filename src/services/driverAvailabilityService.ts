import { DatabaseService } from "../config/database";
import { emitToAdmins } from "../config/socketService";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import {
	computeAvailabilityUi,
	hasReachedAvailabilityDeadline,
	maxClockTimeLabel,
	type AvailabilityPhaseContext,
	type DriverAvailabilityConfig,
	type TripAvailabilitySchedule,
} from "../utils/driverAvailability";
import { parseLocalYmd, getLocalDateOnly } from "../utils/recurringPlan";
import {
	getLocalDayRange,
	phaseDriverActiveScheduledDateWhere,
	phaseDriverScheduledDateWhere,
} from "../utils/routeDayScope";
import {
	getPlanPassengerTripTimes,
	isOfficePickupNextDay,
	resolveDropPhaseDateYmd,
	resolvePhaseStartAt,
	type PassengerTripTimes,
} from "../utils/tripPhaseSchedule";
import { notificationService } from "./notificationService";

const db = DatabaseService.getInstance().getPrisma();

const DEFAULT_ADMIN_OVERRIDE_MINUTES = 10;

type PhaseRowWithSchedule = AvailabilityPhaseContext & {
	pickup_trip_start_time: string | null;
	plan_scheduled_date: Date;
	trip_times: PassengerTripTimes;
};

export class DriverAvailabilityService {
	private async loadPhaseScheduleContext(
		routeDailyPlanId: number,
		rowScheduledDate: Date,
	): Promise<{ plan_scheduled_date: Date; trip_times: PassengerTripTimes }> {
		const fromPlan = await getPlanPassengerTripTimes(db, routeDailyPlanId);
		return {
			plan_scheduled_date: fromPlan?.planScheduledDate ?? rowScheduledDate,
			trip_times:
				fromPlan?.times ?? {
					homePickupTime: null,
					dropOffTime: null,
					officePickUpTime: null,
				},
		};
	}

	private isYesterdayPlanRow(rowScheduledDate: Date, forDay = new Date()): boolean {
		const rowDate = getLocalDateOnly(rowScheduledDate);
		const todayStart = getLocalDayRange(forDay).start;
		return rowDate.getTime() < todayStart.getTime();
	}

	/** Skip stale yesterday PICKUP rows; keep overnight DROP spill. */
	private isActivePhaseRow(
		row: {
			phase: "PICKUP" | "DROP";
			status: string;
			scheduled_date: Date;
		},
		forDay = new Date(),
	): boolean {
		if (!this.isYesterdayPlanRow(row.scheduled_date, forDay)) return true;
		if (row.phase === "PICKUP") {
			return row.status === "ONGOING";
		}
		return row.status !== "COMPLETED";
	}

	private async mapPhaseRow(
		row: {
			id: number;
			route_daily_plan_id: number;
			phase: "PICKUP" | "DROP";
			trip_start_time: string;
			scheduled_date: Date;
			availability_missed_at: Date | null;
			availability_miss_notified_at: Date | null;
			availability_admin_override_until: Date | null;
		},
		pickupTripStart: string | null,
	): Promise<PhaseRowWithSchedule> {
		const schedule = await this.loadPhaseScheduleContext(
			row.route_daily_plan_id,
			row.scheduled_date,
		);
		return {
			phase_driver_id: row.id,
			route_daily_plan_id: row.route_daily_plan_id,
			phase: row.phase,
			trip_start_time: row.trip_start_time.trim(),
			availability_missed_at: row.availability_missed_at,
			availability_miss_notified_at: row.availability_miss_notified_at,
			availability_admin_override_until: row.availability_admin_override_until,
			pickup_trip_start_time: pickupTripStart,
			plan_scheduled_date: schedule.plan_scheduled_date,
			trip_times: schedule.trip_times,
		};
	}

	private async pickEarliestPhaseCandidate(
		candidates: PhaseRowWithSchedule[],
	): Promise<PhaseRowWithSchedule | null> {
		if (candidates.length === 0) return null;
		const withStart = candidates.map((c) => ({
			c,
			startAt: resolvePhaseStartAt(
				c.plan_scheduled_date,
				c.phase,
				c.trip_start_time,
				c.trip_times,
			),
		}));
		withStart.sort((a, b) => {
			const ta = a.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
			const tb = b.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
			if (ta !== tb) return ta - tb;
			if (a.c.phase === "PICKUP" && b.c.phase === "DROP") return -1;
			if (a.c.phase === "DROP" && b.c.phase === "PICKUP") return 1;
			return a.c.phase_driver_id - b.c.phase_driver_id;
		});
		return withStart[0]?.c ?? null;
	}
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

	/**
	 * Next phase that still needs the availability flow (mark before trip_start − availability_time).
	 * PICKUP if not completed; else DROP when pickup on the same plan is completed.
	 */
	async findNextPhaseForAvailability(
		driverId: number,
	): Promise<PhaseRowWithSchedule | null> {
		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				driver_id: driverId,
				status: { not: "COMPLETED" },
				scheduled_date: phaseDriverActiveScheduledDateWhere(),
				trip_start_time: { not: null },
			},
			select: {
				id: true,
				route_daily_plan_id: true,
				phase: true,
				trip_start_time: true,
				status: true,
				scheduled_date: true,
				availability_missed_at: true,
				availability_miss_notified_at: true,
				availability_admin_override_until: true,
			},
			orderBy: [{ scheduled_date: "asc" }, { phase: "asc" }, { id: "asc" }],
		});

		const pickupCandidates: PhaseRowWithSchedule[] = [];
		const dropCandidates: PhaseRowWithSchedule[] = [];

		for (const row of rows) {
			if (!row.trip_start_time?.trim()) continue;
			if (!this.isActivePhaseRow(row)) continue;

			if (row.phase === "PICKUP" && row.status !== "COMPLETED") {
				pickupCandidates.push(
					await this.mapPhaseRow(
						{ ...row, trip_start_time: row.trip_start_time.trim() },
						row.trip_start_time.trim(),
					),
				);
				continue;
			}

			if (row.phase === "DROP") {
				const pickupRow = await db.routeDailyPlanPhaseDriver.findFirst({
					where: {
						route_daily_plan_id: row.route_daily_plan_id,
						phase: "PICKUP",
					},
					select: { status: true, trip_start_time: true },
				});
				if (pickupRow?.status !== "COMPLETED") continue;
				dropCandidates.push(
					await this.mapPhaseRow(
						{ ...row, trip_start_time: row.trip_start_time.trim() },
						pickupRow.trip_start_time?.trim() ?? null,
					),
				);
			}
		}

		const pickupNext = await this.pickEarliestPhaseCandidate(pickupCandidates);
		if (pickupNext) return pickupNext;
		return this.pickEarliestPhaseCandidate(dropCandidates);
	}

	/** ONGOING PICKUP or DROP today (e.g. drop after pickup complete). */
	async findActiveOngoingPhaseForDriver(driverId: number): Promise<
		| (AvailabilityPhaseContext & {
				plan_status: string;
				pickup_trip_start_time: string | null;
		  })
		| null
	> {
		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				driver_id: driverId,
				status: "ONGOING",
				scheduled_date: phaseDriverActiveScheduledDateWhere(),
				trip_start_time: { not: null },
				route_daily_plan: { status: { in: ["PENDING", "ONGOING"] } },
			},
			select: {
				id: true,
				route_daily_plan_id: true,
				phase: true,
				trip_start_time: true,
				status: true,
				scheduled_date: true,
				availability_missed_at: true,
				availability_miss_notified_at: true,
				availability_admin_override_until: true,
				route_daily_plan: { select: { status: true } },
			},
			orderBy: [{ phase: "desc" }, { trip_start_time: "asc" }, { id: "asc" }],
		});

		const active = rows.find(
			(r) => r.trip_start_time?.trim() && this.isActivePhaseRow(r),
		);
		if (!active?.trip_start_time) return null;

		const pickupRow = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				route_daily_plan_id: active.route_daily_plan_id,
				phase: "PICKUP",
			},
			select: { trip_start_time: true },
		});

		const schedule = await this.loadPhaseScheduleContext(
			active.route_daily_plan_id,
			active.scheduled_date,
		);

		return {
			phase_driver_id: active.id,
			route_daily_plan_id: active.route_daily_plan_id,
			phase: active.phase,
			trip_start_time: active.trip_start_time.trim(),
			availability_missed_at: active.availability_missed_at,
			availability_miss_notified_at: active.availability_miss_notified_at,
			availability_admin_override_until:
				active.availability_admin_override_until,
			plan_status: active.route_daily_plan.status,
			pickup_trip_start_time: pickupRow?.trip_start_time?.trim() ?? null,
			plan_scheduled_date: schedule.plan_scheduled_date,
			trip_times: schedule.trip_times,
		};
	}

	/** DB-backed trip times for availability UI (drop phase, last dropoff). */
	async enrichTripSchedule(
		routeDailyPlanId: number,
		schedule: TripAvailabilitySchedule,
	): Promise<TripAvailabilitySchedule> {
		const plan = await db.routeDailyPlan.findUnique({
			where: { id: routeDailyPlanId },
			select: { scheduled_date: true, definition_route_id: true },
		});
		if (!plan) return schedule;

		const [dropPhase, legs] = await Promise.all([
			db.routeDailyPlanPhaseDriver.findFirst({
				where: { route_daily_plan_id: routeDailyPlanId, phase: "DROP" },
				select: { trip_start_time: true },
			}),
			db.routeLeg.findMany({
				where: { route_id: plan.definition_route_id },
				select: { dropoff_time: true },
			}),
		]);

		const dropoffTimes = legs
			.map((l) => l.dropoff_time?.trim())
			.filter((t): t is string => Boolean(t));

		const scheduled = plan.scheduled_date;
		const scheduledDate =
			scheduled instanceof Date
				? scheduled.toISOString().slice(0, 10)
				: String(scheduled).slice(0, 10);

		const tripMeta = await getPlanPassengerTripTimes(db, routeDailyPlanId);
		const times = tripMeta?.times ?? {
			homePickupTime: null,
			dropOffTime: null,
			officePickUpTime: null,
		};
		const officeNextDay = isOfficePickupNextDay(times);

		return {
			...schedule,
			scheduled_date: scheduledDate,
			drop_phase_starts_at: dropPhase?.trip_start_time?.trim() ?? null,
			drop_phase_date: officeNextDay
				? resolveDropPhaseDateYmd(plan.scheduled_date, times)
				: scheduledDate,
			office_pickup_is_next_day: officeNextDay,
			trip_completes_at: maxClockTimeLabel(dropoffTimes),
		};
	}

	async buildAvailabilityPayload(
		driver: {
			id: number;
			is_available: boolean;
			available_at: Date | null;
		},
		config: DriverAvailabilityConfig,
		nextPhase: AvailabilityPhaseContext | null = null,
	) {
		const phaseForAvailability =
			nextPhase ?? (await this.findNextPhaseForAvailability(driver.id));
		const activePhase = await this.findActiveOngoingPhaseForDriver(driver.id);

		const availability_ui = computeAvailabilityUi({
			is_available: driver.is_available,
			config,
			nextPhase: phaseForAvailability,
			activePhase,
		});

		const planIdForSchedule =
			activePhase?.route_daily_plan_id ??
			phaseForAvailability?.route_daily_plan_id;
		if (availability_ui.trip_schedule && planIdForSchedule) {
			availability_ui.trip_schedule = await this.enrichTripSchedule(
				planIdForSchedule,
				availability_ui.trip_schedule,
			);
			const pickupStart =
				phaseForAvailability?.phase === "PICKUP"
					? phaseForAvailability.trip_start_time
					: (phaseForAvailability?.pickup_trip_start_time ??
						activePhase?.pickup_trip_start_time);
			if (pickupStart && availability_ui.trip_schedule) {
				availability_ui.trip_schedule.trip_pickup_starts_at =
					pickupStart.trim();
			}
		}

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

		const phaseRow = await db.routeDailyPlanPhaseDriver.findUnique({
			where: { id: phase.phase_driver_id },
			select: { scheduled_date: true },
		});
		const schedule = await this.loadPhaseScheduleContext(
			phase.route_daily_plan_id,
			phaseRow?.scheduled_date ?? getLocalDateOnly(new Date()),
		);

		if (
			!hasReachedAvailabilityDeadline(
				phase.trip_start_time,
				config.availability_time,
				undefined,
				{
					planScheduledDate: schedule.plan_scheduled_date,
					phase: "PICKUP",
					tripTimes: schedule.trip_times,
				},
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

export type DriverAvailabilityPayload = Awaited<
	ReturnType<DriverAvailabilityService["buildAvailabilityPayload"]>
>;

export const driverAvailabilityService = new DriverAvailabilityService();

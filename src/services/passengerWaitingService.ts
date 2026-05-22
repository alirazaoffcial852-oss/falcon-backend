import { DatabaseService } from "../config/database";
import { emitToAdmins, emitToPassenger } from "../config/socketService";
import {
	buildPassengerWaitingSchedule,
	computeWaitingMilestones,
	getArrivalTimestamp,
	type DriverWaitingConfig,
} from "../utils/passengerWaitingSchedule";
import { parseLocalYmd, getLocalDateOnly } from "../utils/recurringPlan";
import { getLocalDayRange } from "../utils/routeDayScope";
import { driverAvailabilityService } from "./driverAvailabilityService";
import { notificationService } from "./notificationService";

const db = DatabaseService.getInstance().getPrisma();

type WaitingNotifyPayload = {
	phasePassengerId: number;
	phaseDriverId: number;
	driverId: number;
	driverName: string;
	passengerId: number;
	passengerName: string;
	routeId: number | null;
	routeDailyPlanId: number;
	phase: "PICKUP" | "DROP";
	arrivedAt: Date;
	notifiedAt: Date;
};

export class PassengerWaitingService {
	async getConfig(): Promise<DriverWaitingConfig | null> {
		const row = await db.driverConfiguration.findFirst();
		if (!row) return null;
		return {
			passenger_waiting_time: row.passenger_waiting_time,
			still_waiting_button_appear_in: row.still_waiting_button_appear_in,
			skip_button_appear_in: row.skip_button_appear_in,
		};
	}

	buildScheduleForPhasePassenger(
		pp: {
			driver_arrived_at: Date | null;
			dropoff_arrived_at: Date | null;
			still_waiting_phase_notified_at: Date | null;
			skip_phase_notified_at: Date | null;
			move_next_notified_at: Date | null;
		},
		phase: "PICKUP" | "DROP",
		config: DriverWaitingConfig | null,
		now?: Date,
	) {
		return buildPassengerWaitingSchedule({
			phase,
			driver_arrived_at: pp.driver_arrived_at,
			dropoff_arrived_at: pp.dropoff_arrived_at,
			still_waiting_phase_notified_at: pp.still_waiting_phase_notified_at,
			skip_phase_notified_at: pp.skip_phase_notified_at,
			move_next_notified_at: pp.move_next_notified_at,
			config,
			now,
		});
	}

	private async notifyPassengerAndAdmins(
		payload: WaitingNotifyPayload,
		opts: {
			eventType: string;
			socketPassengerEvent: string;
			socketAdminEvent: string;
			passengerTitle: string;
			passengerBody: string;
			adminTitle: string;
			adminBody: string;
			passengerDataType: string;
		},
	): Promise<void> {
		const eventPayload = {
			type: opts.eventType,
			driver_id: payload.driverId,
			driver_name: payload.driverName,
			passenger_id: payload.passengerId,
			passenger_name: payload.passengerName,
			phase_passenger_id: payload.phasePassengerId,
			phase_driver_id: payload.phaseDriverId,
			route_id: payload.routeId,
			route_daily_plan_id: payload.routeDailyPlanId,
			phase: payload.phase,
			arrived_at: payload.arrivedAt.toISOString(),
			notified_at: payload.notifiedAt.toISOString(),
		};

		emitToPassenger(payload.passengerId, opts.socketPassengerEvent, {
			...eventPayload,
			driverId: payload.driverId,
			driverName: payload.driverName,
		});

		void notificationService.sendToPassengerIds([payload.passengerId], {
			title: opts.passengerTitle,
			body: opts.passengerBody,
			data: {
				type: opts.passengerDataType,
				driverId: String(payload.driverId),
				passengerId: String(payload.passengerId),
				phase_passenger_id: String(payload.phasePassengerId),
				routeId: payload.routeId != null ? String(payload.routeId) : "",
				phase: payload.phase,
			},
		});

		emitToAdmins(opts.socketAdminEvent, eventPayload);

		const adminUserIds = await driverAvailabilityService.getAdminUserIds();
		if (adminUserIds.length > 0) {
			void notificationService.sendToUsers(adminUserIds, {
				title: opts.adminTitle,
				body: opts.adminBody,
				data: {
					type: opts.eventType,
					driverId: String(payload.driverId),
					passengerId: String(payload.passengerId),
					phase_passenger_id: String(payload.phasePassengerId),
					phase_driver_id: String(payload.phaseDriverId),
					route_daily_plan_id: String(payload.routeDailyPlanId),
					routeId:
						payload.routeId != null ? String(payload.routeId) : "",
					phase: payload.phase,
				},
			});
		}
	}

	private async loadNotifyPayload(
		phasePassengerId: number,
		notifiedAt: Date,
	): Promise<WaitingNotifyPayload | null> {
		const row = await db.routeDailyPlanPhasePassenger.findUnique({
			where: { id: phasePassengerId },
			include: {
				passenger: { select: { id: true, name: true } },
				route_daily_plan_phase_driver: {
					include: {
						driver: { select: { id: true, name: true } },
						route_daily_plan: { select: { id: true } },
					},
				},
			},
		});
		if (!row) return null;

		const phaseDriver = row.route_daily_plan_phase_driver;
		const execRoute = await db.route.findFirst({
			where: { route_daily_plan_id: phaseDriver.route_daily_plan_id },
			select: { id: true },
		});
		const arrivedAt = getArrivalTimestamp(
			phaseDriver.phase,
			row.driver_arrived_at,
			row.dropoff_arrived_at,
		);
		if (!arrivedAt) return null;

		return {
			phasePassengerId: row.id,
			phaseDriverId: phaseDriver.id,
			driverId: phaseDriver.driver_id,
			driverName: phaseDriver.driver.name,
			passengerId: row.passenger_id,
			passengerName: row.passenger.name,
			routeId: execRoute?.id ?? null,
			routeDailyPlanId: phaseDriver.route_daily_plan_id,
			phase: phaseDriver.phase,
			arrivedAt,
			notifiedAt,
		};
	}

	/** T1: still_waiting phase starts — passenger + admin */
	async sendStillWaitingPhaseStart(phasePassengerId: number): Promise<boolean> {
		const now = new Date();
		const updated = await db.routeDailyPlanPhasePassenger.updateMany({
			where: {
				id: phasePassengerId,
				status: "ARRIVED",
				still_waiting_phase_notified_at: null,
			},
			data: { still_waiting_phase_notified_at: now },
		});
		if (updated.count === 0) return false;

		const payload = await this.loadNotifyPayload(phasePassengerId, now);
		if (!payload) return true;

		const phaseLabel = payload.phase === "PICKUP" ? "pickup" : "drop-off";
		await this.notifyPassengerAndAdmins(payload, {
			eventType: "still_waiting_phase_start",
			socketPassengerEvent: "passenger:still_waiting_phase_start",
			socketAdminEvent: "driver:still_waiting",
			passengerTitle: "Driver waiting",
			passengerBody: `Your driver is waiting at the ${phaseLabel} location. Please come out.`,
			adminTitle: "Driver still waiting",
			adminBody: `${payload.driverName} is waiting for ${payload.passengerName} (${phaseLabel})`,
			passengerDataType: "still_waiting_phase_start",
		});
		return true;
	}

	/** T2: skip countdown starts — passenger + admin */
	async sendSkipPhaseStart(phasePassengerId: number): Promise<boolean> {
		const now = new Date();
		const updated = await db.routeDailyPlanPhasePassenger.updateMany({
			where: {
				id: phasePassengerId,
				status: { in: ["ARRIVED", "STILL_WAITING"] },
				still_waiting_phase_notified_at: { not: null },
				skip_phase_notified_at: null,
			},
			data: { skip_phase_notified_at: now },
		});
		if (updated.count === 0) return false;

		const payload = await this.loadNotifyPayload(phasePassengerId, now);
		if (!payload) return true;

		const phaseLabel = payload.phase === "PICKUP" ? "pickup" : "drop-off";
		await this.notifyPassengerAndAdmins(payload, {
			eventType: "skip_phase_start",
			socketPassengerEvent: "passenger:skip_phase_start",
			socketAdminEvent: "driver:waiting_skip_phase",
			passengerTitle: "Driver still waiting",
			passengerBody: `Your driver is still at the ${phaseLabel}. Please respond soon.`,
			adminTitle: "Extended wait at stop",
			adminBody: `${payload.driverName} still waiting for ${payload.passengerName} — skip window started (${phaseLabel})`,
			passengerDataType: "skip_phase_start",
		});
		return true;
	}

	/** T3: MOVE_TO_NEXT available — passenger + admin */
	async sendMoveNextReady(phasePassengerId: number): Promise<boolean> {
		const now = new Date();
		const updated = await db.routeDailyPlanPhasePassenger.updateMany({
			where: {
				id: phasePassengerId,
				status: { in: ["ARRIVED", "STILL_WAITING"] },
				skip_phase_notified_at: { not: null },
				move_next_notified_at: null,
			},
			data: { move_next_notified_at: now },
		});
		if (updated.count === 0) return false;

		const payload = await this.loadNotifyPayload(phasePassengerId, now);
		if (!payload) return true;

		const phaseLabel = payload.phase === "PICKUP" ? "pickup" : "drop-off";
		await this.notifyPassengerAndAdmins(payload, {
			eventType: "move_next_ready",
			socketPassengerEvent: "passenger:move_next_ready",
			socketAdminEvent: "driver:move_next_ready",
			passengerTitle: "Trip update",
			passengerBody: `Your driver may proceed from the ${phaseLabel} location.`,
			adminTitle: "Driver can move to next stop",
			adminBody: `${payload.driverName} can move to next stop after waiting for ${payload.passengerName} (${phaseLabel})`,
			passengerDataType: "move_next_ready",
		});
		return true;
	}

	async processPhasePassenger(
		phasePassengerId: number,
		config: DriverWaitingConfig,
		now = new Date(),
	): Promise<number> {
		const row = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				id: phasePassengerId,
				status: { in: ["ARRIVED", "STILL_WAITING"] },
				OR: [
					{ driver_arrived_at: { not: null } },
					{ dropoff_arrived_at: { not: null } },
				],
				route_daily_plan_phase_driver: {
					status: "ONGOING",
					route_daily_plan: { status: "ONGOING" },
				},
			},
			select: {
				id: true,
				driver_arrived_at: true,
				dropoff_arrived_at: true,
				still_waiting_phase_notified_at: true,
				skip_phase_notified_at: true,
				move_next_notified_at: true,
				route_daily_plan_phase_driver: { select: { phase: true } },
			},
		});
		if (!row) return 0;

		const phase = row.route_daily_plan_phase_driver.phase;
		const arrivedAt = getArrivalTimestamp(
			phase,
			row.driver_arrived_at,
			row.dropoff_arrived_at,
		);
		if (!arrivedAt) return 0;

		const milestones = computeWaitingMilestones(arrivedAt, config);
		if (!milestones) return 0;

		let sent = 0;
		const { still_waiting_phase_start_at: t1, skip_phase_start_at: t2, move_next_button_at: t3 } =
			milestones;

		if (
			now.getTime() >= t1.getTime() &&
			!row.still_waiting_phase_notified_at &&
			(await this.sendStillWaitingPhaseStart(phasePassengerId))
		) {
			sent += 1;
		}

		if (
			now.getTime() >= t2.getTime() &&
			!row.skip_phase_notified_at &&
			(await this.sendSkipPhaseStart(phasePassengerId))
		) {
			sent += 1;
		}

		if (
			now.getTime() >= t3.getTime() &&
			!row.move_next_notified_at &&
			(await this.sendMoveNextReady(phasePassengerId))
		) {
			sent += 1;
		}

		return sent;
	}

	async processAllPassengerWaitingNotifications(): Promise<number> {
		const config = await this.getConfig();
		if (!config) return 0;

		const now = new Date();
		const rows = await db.routeDailyPlanPhasePassenger.findMany({
			where: {
				status: { in: ["ARRIVED", "STILL_WAITING"] },
				OR: [
					{ driver_arrived_at: { not: null } },
					{ dropoff_arrived_at: { not: null } },
				],
				route_daily_plan_phase_driver: {
					status: "ONGOING",
					route_daily_plan: { status: "ONGOING" },
				},
			},
			select: { id: true },
		});

		let sent = 0;
		for (const row of rows) {
			sent += await this.processPhasePassenger(row.id, config, now);
		}
		return sent;
	}

	async processForDriver(driverId: number): Promise<number> {
		const config = await this.getConfig();
		if (!config) return 0;

		const now = new Date();
		const rows = await db.routeDailyPlanPhasePassenger.findMany({
			where: {
				status: { in: ["ARRIVED", "STILL_WAITING"] },
				OR: [
					{ driver_arrived_at: { not: null } },
					{ dropoff_arrived_at: { not: null } },
				],
				route_daily_plan_phase_driver: {
					driver_id: driverId,
					status: "ONGOING",
					route_daily_plan: { status: "ONGOING" },
				},
			},
			select: { id: true },
		});

		let sent = 0;
		for (const row of rows) {
			sent += await this.processPhasePassenger(row.id, config, now);
		}
		return sent;
	}

	async listStillWaitingForDate(dateStr?: string) {
		const forDay = dateStr?.trim()
			? parseLocalYmd(dateStr.trim())
			: getLocalDateOnly(new Date());
		const { start, end } = getLocalDayRange(forDay);

		const rows = await db.routeDailyPlanPhasePassenger.findMany({
			where: {
				still_waiting_phase_notified_at: { not: null },
				route_daily_plan_phase_driver: {
					scheduled_date: { gte: start, lt: end },
				},
			},
			include: {
				passenger: { select: { id: true, name: true, phone_no: true } },
				route_daily_plan_phase_driver: {
					include: {
						driver: { select: { id: true, name: true, phone_no: true } },
						route_daily_plan: {
							select: {
								id: true,
								definition_route: {
									select: {
										company: { select: { id: true, name: true } },
									},
								},
							},
						},
					},
				},
			},
			orderBy: [{ still_waiting_phase_notified_at: "desc" }, { id: "desc" }],
		});

		const planIds = [
			...new Set(
				rows.map((r) => r.route_daily_plan_phase_driver.route_daily_plan_id),
			),
		];
		const execRoutes =
			planIds.length === 0
				? []
				: await db.route.findMany({
						where: { route_daily_plan_id: { in: planIds } },
						select: { id: true, route_daily_plan_id: true },
					});
		const routeIdsByPlan = new Map(
			execRoutes.map((e) => [e.route_daily_plan_id, e.id] as const),
		);

		return {
			date: dateStr ?? forDay.toISOString().slice(0, 10),
			rows: rows.map((r) => {
				const pd = r.route_daily_plan_phase_driver;
				return {
					phase_passenger_id: r.id,
					phase_driver_id: pd.id,
					driver_id: pd.driver_id,
					driver_name: pd.driver.name,
					driver_phone_no: pd.driver.phone_no,
					passenger_id: r.passenger_id,
					passenger_name: r.passenger.name,
					passenger_phone_no: r.passenger.phone_no,
					phase: pd.phase,
					status: r.status,
					driver_arrived_at: r.driver_arrived_at,
					dropoff_arrived_at: r.dropoff_arrived_at,
					still_waiting_phase_notified_at: r.still_waiting_phase_notified_at,
					skip_phase_notified_at: r.skip_phase_notified_at,
					move_next_notified_at: r.move_next_notified_at,
					route_daily_plan_id: pd.route_daily_plan_id,
					route_id: routeIdsByPlan.get(pd.route_daily_plan_id) ?? null,
					company_name:
						pd.route_daily_plan.definition_route.company.name,
				};
			}),
		};
	}
}

export const passengerWaitingService = new PassengerWaitingService();

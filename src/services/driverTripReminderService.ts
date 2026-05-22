import { DatabaseService } from "../config/database";
import { emitToDriver } from "../config/socketService";
import {
	hasReachedTripStartReminderTime,
	type DriverAvailabilityConfig,
} from "../utils/driverAvailability";
import { phaseDriverScheduledDateWhere } from "../utils/routeDayScope";
import { notificationService } from "./notificationService";

const db = DatabaseService.getInstance().getPrisma();

export class DriverTripReminderService {
	/** Send once per phase row when trip_start − remaining_start_time is reached. */
	async sendTripStartReminder(phaseDriverId: number): Promise<boolean> {
		const now = new Date();
		const updated = await db.routeDailyPlanPhaseDriver.updateMany({
			where: {
				id: phaseDriverId,
				phase: "PICKUP",
				status: "PENDING",
				trip_started_at: null,
				trip_start_reminder_sent_at: null,
				driver: { is_available: true },
			},
			data: { trip_start_reminder_sent_at: now },
		});
		if (updated.count === 0) return false;

		const phase = await db.routeDailyPlanPhaseDriver.findUnique({
			where: { id: phaseDriverId },
			select: {
				id: true,
				driver_id: true,
				route_daily_plan_id: true,
				trip_start_time: true,
				driver: { select: { name: true } },
			},
		});
		if (!phase?.trip_start_time?.trim()) return true;

		const tripStart = phase.trip_start_time.trim();
		const eventPayload = {
			type: "trip_start_reminder",
			phase_driver_id: phase.id,
			route_daily_plan_id: phase.route_daily_plan_id,
			trip_start_time: tripStart,
			sent_at: now.toISOString(),
		};

		emitToDriver(phase.driver_id, "driver:trip_start_reminder", eventPayload);

		void notificationService.sendToDriverId(phase.driver_id, {
			title: "Time to start trip",
			body: `Your trip starts at ${tripStart}. Please start the ride.`,
			data: {
				type: "trip_start_reminder",
				phase_driver_id: String(phase.id),
				route_daily_plan_id: String(phase.route_daily_plan_id),
				trip_start_time: tripStart,
			},
		});

		return true;
	}

	async processTripStartReminderForDriver(
		driverId: number,
		config: DriverAvailabilityConfig,
	): Promise<boolean> {
		const driver = await db.driver.findUnique({
			where: { id: driverId },
			select: { is_available: true },
		});
		if (!driver?.is_available) return false;

		const phase = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				driver_id: driverId,
				phase: "PICKUP",
				status: "PENDING",
				trip_started_at: null,
				trip_start_reminder_sent_at: null,
				scheduled_date: phaseDriverScheduledDateWhere(),
				trip_start_time: { not: null },
			},
			orderBy: [{ trip_start_time: "asc" }, { id: "asc" }],
			select: { id: true, trip_start_time: true },
		});

		if (!phase?.trip_start_time?.trim()) return false;
		if (
			!hasReachedTripStartReminderTime(
				phase.trip_start_time,
				config.remaining_start_time,
			)
		) {
			return false;
		}

		return this.sendTripStartReminder(phase.id);
	}

	async processAllTripStartReminders(): Promise<number> {
		const config = await db.driverConfiguration.findFirst();
		if (!config) return 0;

		const phases = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				phase: "PICKUP",
				status: "PENDING",
				trip_started_at: null,
				trip_start_reminder_sent_at: null,
				scheduled_date: phaseDriverScheduledDateWhere(),
				trip_start_time: { not: null },
				driver: { is_available: true },
			},
			select: { id: true, trip_start_time: true },
		});

		let sent = 0;
		for (const row of phases) {
			if (!row.trip_start_time?.trim()) continue;
			if (
				!hasReachedTripStartReminderTime(
					row.trip_start_time,
					config.remaining_start_time,
				)
			) {
				continue;
			}
			if (await this.sendTripStartReminder(row.id)) sent += 1;
		}
		return sent;
	}
}

export const driverTripReminderService = new DriverTripReminderService();

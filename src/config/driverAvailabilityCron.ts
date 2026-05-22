import cron from "node-cron";
import { driverAvailabilityService } from "../services/driverAvailabilityService";
import { driverTripReminderService } from "../services/driverTripReminderService";

/**
 * Every minute:
 * - Missed availability → notify admins (trip_start − availability_time).
 * - Trip start reminder → notify driver (trip_start − remaining_start_time).
 *
 * `DRIVER_AVAILABILITY_CRON` — default every minute.
 */
export function initDriverAvailabilityCron(): void {
	if (process.env.VERCEL === "1") {
		console.log("[cron] driver availability: skipped (Vercel serverless)");
		return;
	}
	if (process.env.DRIVER_AVAILABILITY_CRON_ENABLED === "false") {
		console.log(
			"[cron] driver availability: disabled (DRIVER_AVAILABILITY_CRON_ENABLED=false)",
		);
		return;
	}

	const schedule = process.env.DRIVER_AVAILABILITY_CRON ?? "* * * * *";

	cron.schedule(schedule, async () => {
		try {
			const missed =
				await driverAvailabilityService.processAllMissedAvailability();
			if (missed > 0) {
				console.log(`[cron] driver availability missed: notified=${missed}`);
			}
			const reminders =
				await driverTripReminderService.processAllTripStartReminders();
			if (reminders > 0) {
				console.log(`[cron] trip start reminders sent: ${reminders}`);
			}
		} catch (err) {
			console.error("[cron] driver availability / trip reminder failed:", err);
		}
	});

	console.log(
		`[cron] driver availability + trip start reminder scheduled: ${schedule}`,
	);
}

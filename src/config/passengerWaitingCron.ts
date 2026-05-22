import cron from "node-cron";
import { passengerWaitingService } from "../services/passengerWaitingService";

/**
 * When driver_arrived_at + passenger_waiting_time elapses, notify passenger + admins once.
 *
 * `PASSENGER_WAITING_CRON` — default every minute (same as driver availability).
 */
export function initPassengerWaitingCron(): void {
	if (process.env.VERCEL === "1") {
		console.log("[cron] passenger waiting: skipped (Vercel serverless)");
		return;
	}
	if (process.env.PASSENGER_WAITING_CRON_ENABLED === "false") {
		console.log(
			"[cron] passenger waiting: disabled (PASSENGER_WAITING_CRON_ENABLED=false)",
		);
		return;
	}

	const schedule =
		process.env.PASSENGER_WAITING_CRON ??
		process.env.DRIVER_AVAILABILITY_CRON ??
		"* * * * *";

	cron.schedule(schedule, async () => {
		try {
			const n =
				await passengerWaitingService.processAllPassengerWaitingNotifications();
			if (n > 0) {
				console.log(`[cron] passenger waiting elapsed: notified=${n}`);
			}
		} catch (err) {
			console.error("[cron] passenger waiting check failed:", err);
		}
	});

	console.log(`[cron] passenger waiting notifications scheduled: ${schedule}`);
}

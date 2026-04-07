import cron from "node-cron";
import { RouteService } from "../services/routeService";

const routeService = new RouteService();

/**
 * Creates today's `RouteDailyPlan` (`scheduled_date` = today) for each definition route where
 * `recurring_plan_start <= today` (recurring has started). `recurring_plan_end` is not used for this job.
 * Skips if a plan already exists for that definition + date (duplicate), holiday, or leave.
 * Disabled on Vercel (no long-running process) or when `DAILY_ROUTE_CRON_ENABLED=false`.
 *
 * `DAILY_ROUTE_CRON` — cron expression (default `5 0 * * *` = 00:05 daily, server local time).
 */
export function initDailyRouteCron(): void {
	if (process.env.VERCEL === "1") {
		console.log("[cron] daily routes: skipped (Vercel serverless)");
		return;
	}
	if (process.env.DAILY_ROUTE_CRON_ENABLED === "false") {
		console.log(
			"[cron] daily routes: disabled (DAILY_ROUTE_CRON_ENABLED=false)",
		);
		return;
	}

	const schedule = process.env.DAILY_ROUTE_CRON ?? "5 0 * * *";

	cron.schedule(schedule, async () => {
		console.log(`[cron] daily route spawn (${schedule})`);
		try {
			const result = await routeService.generateDailyInstancesForDate(
				new Date(),
				{
					plannedOnly: true,
				},
			);
			console.log("result", result);
			console.log(
				`[cron] daily routes: created_ids=${result.created.length} skipped=${result.skipped.length}`,
			);
		} catch (err) {
			console.error("[cron] daily route spawn failed:", err);
		}
	});

	console.log(
		`[cron] daily routes scheduled: ${schedule} (recurring_plan_start <= today; no recurring_plan_end filter)`,
	);
}

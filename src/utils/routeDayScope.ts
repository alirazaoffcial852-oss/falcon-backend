import type { Prisma } from "../generated/prisma/client";

/** UTC midnight range for the calendar day represented by `forDay`. */
export function getLocalDayRange(forDay: Date = new Date()): {
	start: Date;
	end: Date;
} {
	const start = new Date(forDay);
	start.setUTCHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setUTCDate(end.getUTCDate() + 1);
	return { start, end };
}

/** Filter RouteDailyPlan rows for a single local calendar day. */
export function dailyPlanForActiveDayWhere(
	forDay: Date = new Date(),
): Prisma.RouteDailyPlanWhereInput {
	const { start, end } = getLocalDayRange(forDay);
	return {
		scheduled_date: { gte: start, lt: end },
	};
}

/** Same day range for `RouteDailyPlanPhaseDriver.scheduled_date`. */
export function phaseDriverScheduledDateWhere(
	forDay: Date = new Date(),
): Prisma.DateTimeFilter {
	const { start, end } = getLocalDayRange(forDay);
	return { gte: start, lt: end };
}

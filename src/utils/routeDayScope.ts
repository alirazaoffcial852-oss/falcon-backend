import type { Prisma } from "../generated/prisma/client";
import { addLocalDays, getLocalDateOnly } from "./recurringPlan";

/** UTC midnight range for the calendar day represented by `forDay`. */
export function getLocalDayRange(forDay: Date = new Date()): {
	start: Date;
	end: Date;
} {
	const start = getLocalDateOnly(forDay);
	const end = addLocalDays(start, 1);
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

/**
 * Yesterday + today plan dates — keeps overnight DROP phases visible after midnight
 * (office pick next calendar day while plan `scheduled_date` stays on pickup night).
 */
export function phaseDriverActiveScheduledDateWhere(
	forDay: Date = new Date(),
): Prisma.DateTimeFilter {
	const today = getLocalDayRange(forDay);
	const yesterday = getLocalDayRange(addLocalDays(forDay, -1));
	return { gte: yesterday.start, lt: today.end };
}

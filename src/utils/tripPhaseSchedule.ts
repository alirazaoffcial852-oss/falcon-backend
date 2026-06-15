import type { PrismaClient } from "../generated/prisma/client";
import { addLocalDays, getLocalDateOnly } from "./recurringPlan";
import { parseTimeToMinutesFromMidnight } from "./pickupSchedule";
import { getFirstRouteLegInPickupOrder } from "./routeFirstPickupLeg";

export type PassengerTripTimes = {
	homePickupTime: string | null;
	dropOffTime: string | null;
	officePickUpTime: string | null;
};

/** True when office pick is after midnight relative to home pickup / office drop (same shift). */
export function isOfficePickupNextDay(times: PassengerTripTimes): boolean {
	const officeMin = parseTimeToMinutesFromMidnight(times.officePickUpTime);
	if (officeMin == null) return false;

	const homeMin = parseTimeToMinutesFromMidnight(times.homePickupTime);
	const dropMin = parseTimeToMinutesFromMidnight(times.dropOffTime);

	if (homeMin == null && dropMin == null) return false;

	const refs = [homeMin, dropMin].filter((x): x is number => x != null);
	return refs.every((ref) => officeMin < ref);
}

export function resolveDropPhaseDayOffset(times: PassengerTripTimes): 0 | 1 {
	return isOfficePickupNextDay(times) ? 1 : 0;
}

export function dateOnlyToYmd(dateOnly: Date): string {
	return getLocalDateOnly(dateOnly).toISOString().slice(0, 10);
}

/** UTC calendar date + HH:MM (matches `scheduled_date` @db.Date storage). */
export function combineDateAndTimeMinutes(
	dateOnly: Date,
	timeHHMM: string,
	dayOffset = 0,
): Date | null {
	const mins = parseTimeToMinutesFromMidnight(timeHHMM);
	if (mins == null) return null;
	const d = getLocalDateOnly(dateOnly);
	d.setUTCDate(d.getUTCDate() + dayOffset);
	d.setUTCHours(Math.floor(mins / 60), mins % 60, 0, 0);
	return d;
}

export function formatUtcDateToHHMM(d: Date): string {
	const h = d.getUTCHours();
	const min = d.getUTCMinutes();
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function resolvePhaseStartAt(
	planScheduledDate: Date,
	phase: "PICKUP" | "DROP",
	tripStartTime: string,
	times: PassengerTripTimes,
): Date | null {
	const trimmed = tripStartTime.trim();
	if (!trimmed) return null;
	if (phase === "PICKUP") {
		return combineDateAndTimeMinutes(planScheduledDate, trimmed, 0);
	}
	return combineDateAndTimeMinutes(
		planScheduledDate,
		trimmed,
		resolveDropPhaseDayOffset(times),
	);
}

export function resolveDropPhaseDateYmd(
	planScheduledDate: Date,
	times: PassengerTripTimes,
): string {
	const offset = resolveDropPhaseDayOffset(times);
	return dateOnlyToYmd(addLocalDays(planScheduledDate, offset));
}

export async function getPlanPassengerTripTimes(
	prisma: PrismaClient,
	routeDailyPlanId: number,
): Promise<{ planScheduledDate: Date; times: PassengerTripTimes } | null> {
	const plan = await prisma.routeDailyPlan.findUnique({
		where: { id: routeDailyPlanId },
		select: {
			scheduled_date: true,
			definition_route_id: true,
			execution_route: { select: { id: true } },
		},
	});
	if (!plan) return null;

	const routeId = plan.execution_route?.id ?? plan.definition_route_id;
	const firstLeg = await getFirstRouteLegInPickupOrder(prisma, routeId);

	return {
		planScheduledDate: plan.scheduled_date,
		times: {
			homePickupTime: firstLeg?.pickup_time?.trim() ?? null,
			dropOffTime: firstLeg?.dropoff_time?.trim() ?? null,
			officePickUpTime: firstLeg?.office_pick_up_time?.trim() ?? null,
		},
	};
}

import { DatabaseService } from "../config/database";
import { dailyPlanForActiveDayWhere } from "./routeDayScope";

const db = DatabaseService.getInstance().getPrisma();

export type DriverContactForBroadcast = {
	id: number;
	user_id: number | null;
	name: string;
	phone_no: string | null;
	user: { email: string } | null;
};

/**
 * Resolve socket payload id to canonical driver.id.
 * Mobile apps often send JWT user_id in `driverId`; try user_id before driver.id
 * so we do not match a different row whose primary key equals that number.
 */
export async function resolveDriverFromLocationPayload(
	rawId: number,
): Promise<DriverContactForBroadcast | null> {
	if (!Number.isFinite(rawId)) return null;

	const select = {
		id: true,
		user_id: true,
		name: true,
		phone_no: true,
		user: { select: { email: true } },
	} as const;

	const byUserId = await db.driver.findFirst({
		where: { user_id: rawId },
		select,
	});
	if (byUserId) return byUserId;

	const byDriverId = await db.driver.findUnique({
		where: { id: rawId },
		select,
	});
	if (byDriverId) return byDriverId;

	const routeDriver = await db.route.findFirst({
		where: {
			OR: [{ driver_id: rawId }, { driver: { user_id: rawId } }],
		},
		orderBy: { id: "desc" },
		select: { driver: { select } },
	});
	return routeDriver?.driver ?? null;
}

export async function findOngoingExecutionRouteForDriver(driverId: number) {
	return db.route.findFirst({
		where: {
			driver_id: driverId,
			route_daily_plan_id: { not: null },
			daily_plan: {
				status: "ONGOING",
				...dailyPlanForActiveDayWhere(),
			},
		},
		include: { legs: { select: { passenger_id: true } } },
		orderBy: { id: "desc" },
	});
}

/** Passenger ids on today's ONGOING execution route (legs + phase-passenger rows). */
export async function getPassengerIdsForDriverLocationBroadcast(
	driverId: number,
): Promise<number[]> {
	const route = await findOngoingExecutionRouteForDriver(driverId);
	if (!route) return [];

	const ids = new Set(route.legs.map((l) => l.passenger_id));
	const planId = route.route_daily_plan_id;
	if (planId != null) {
		const phaseRows = await db.routeDailyPlanPhasePassenger.findMany({
			where: {
				route_daily_plan_phase_driver: {
					route_daily_plan_id: planId,
					driver_id: driverId,
				},
			},
			select: { passenger_id: true },
		});
		for (const row of phaseRows) ids.add(row.passenger_id);
	}
	return [...ids];
}

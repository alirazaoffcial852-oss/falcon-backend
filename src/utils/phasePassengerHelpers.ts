import type { $Enums, Prisma } from "../generated/prisma/client";
import type { PrismaClient } from "../generated/prisma/client";
import type { PhasePassengerStatus } from "../generated/prisma/client";

export async function getRouteDailyPlanId(
	db: PrismaClient,
	routeId: number,
): Promise<number | null> {
	const r = await db.route.findUnique({
		where: { id: routeId },
		select: { route_daily_plan_id: true },
	});
	return r?.route_daily_plan_id ?? null;
}

export async function getPhaseDriverId(
	db: PrismaClient,
	routeDailyPlanId: number,
	phase: "PICKUP" | "DROP",
): Promise<number | null> {
	const pd = await db.routeDailyPlanPhaseDriver.findFirst({
		where: { route_daily_plan_id: routeDailyPlanId, phase },
		select: { id: true },
	});
	return pd?.id ?? null;
}

/** @returns number of rows updated (0 if phase driver or row missing). */
export async function updatePhasePassengerRow(
	db: PrismaClient,
	routeDailyPlanId: number,
	phase: "PICKUP" | "DROP",
	passengerId: number,
	data: Prisma.RouteDailyPlanPhasePassengerUpdateInput,
): Promise<number> {
	const pdId = await getPhaseDriverId(db, routeDailyPlanId, phase);
	if (!pdId) return 0;
	const res = await db.routeDailyPlanPhasePassenger.updateMany({
		where: {
			route_daily_plan_phase_driver_id: pdId,
			passenger_id: passengerId,
		},
		data,
	});
	return res.count;
}

export async function setPhasePassengerStatus(
	db: PrismaClient,
	routeDailyPlanId: number,
	phase: "PICKUP" | "DROP",
	passengerId: number,
	status: PhasePassengerStatus,
): Promise<void> {
	void (await updatePhasePassengerRow(db, routeDailyPlanId, phase, passengerId, {
		status,
	}));
}

/** PICKUP-phase extras for driver queue (per passenger). */
export async function getPickupPhasePassengerExtrasByPassengerId(
	db: PrismaClient,
	routeDailyPlanId: number,
): Promise<
	Map<
		number,
		{
			passenger_ack: $Enums.PassengerAck | null;
			driver_arrived_at: Date | null;
		}
	>
> {
	const pdId = await getPhaseDriverId(db, routeDailyPlanId, "PICKUP");
	if (!pdId) return new Map();
	const rows = await db.routeDailyPlanPhasePassenger.findMany({
		where: { route_daily_plan_phase_driver_id: pdId },
		select: {
			passenger_id: true,
			passenger_ack: true,
			driver_arrived_at: true,
		},
	});
	const m = new Map<
		number,
		{
			passenger_ack: $Enums.PassengerAck | null;
			driver_arrived_at: Date | null;
		}
	>();
	for (const r of rows) {
		m.set(r.passenger_id, {
			passenger_ack: r.passenger_ack,
			driver_arrived_at: r.driver_arrived_at,
		});
	}
	return m;
}

/** Load passenger_id -> status for one phase (PICKUP or DROP). */
export async function getPhaseStatusMapByPassengerId(
	db: PrismaClient,
	routeDailyPlanId: number,
	phase: "PICKUP" | "DROP",
): Promise<Map<number, PhasePassengerStatus>> {
	const pdId = await getPhaseDriverId(db, routeDailyPlanId, phase);
	if (!pdId) return new Map();
	const rows = await db.routeDailyPlanPhasePassenger.findMany({
		where: { route_daily_plan_phase_driver_id: pdId },
		select: { passenger_id: true, status: true },
	});
	const m = new Map<number, PhasePassengerStatus>();
	for (const r of rows) {
		m.set(r.passenger_id, r.status);
	}
	return m;
}

export async function findNextPickupLegInBatch(
	db: PrismaClient,
	routeId: number,
	batchId: number,
	excludeLegId: number,
	routeDailyPlanId: number,
) {
	const pickupPdId = await getPhaseDriverId(db, routeDailyPlanId, "PICKUP");
	if (!pickupPdId) return null;
	const legs = await db.routeLeg.findMany({
		where: { route_id: routeId, batch_id: batchId },
		orderBy: { sequence: "asc" },
		include: { passenger: true },
	});
	for (const l of legs) {
		if (l.id === excludeLegId) continue;
		const pp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				route_daily_plan_phase_driver_id: pickupPdId,
				passenger_id: l.passenger_id,
				status: { in: ["PENDING", "ARRIVED", "STILL_WAITING"] },
			},
		});
		if (pp) return l;
	}
	return null;
}

export async function countPickupPendingOrArrivedInBatch(
	db: PrismaClient,
	routeId: number,
	batchId: number,
	routeDailyPlanId: number,
): Promise<number> {
	const pickupPdId = await getPhaseDriverId(db, routeDailyPlanId, "PICKUP");
	if (!pickupPdId) return 0;
	const legPassengers = await db.routeLeg.findMany({
		where: { route_id: routeId, batch_id: batchId },
		select: { passenger_id: true },
	});
	const ids = [...new Set(legPassengers.map((x) => x.passenger_id))];
	if (ids.length === 0) return 0;
	return db.routeDailyPlanPhasePassenger.count({
		where: {
			route_daily_plan_phase_driver_id: pickupPdId,
			passenger_id: { in: ids },
			status: { in: ["PENDING", "ARRIVED", "STILL_WAITING"] },
		},
	});
}

export async function findNextDropLegInBatch(
	db: PrismaClient,
	routeId: number,
	batchId: number,
	excludeLegId: number,
	routeDailyPlanId: number,
) {
	const dropPdId = await getPhaseDriverId(db, routeDailyPlanId, "DROP");
	if (!dropPdId) return null;
	const legs = await db.routeLeg.findMany({
		where: { route_id: routeId, batch_id: batchId },
		orderBy: { drop_sequence: "asc" },
		include: { passenger: true },
	});
	for (const l of legs) {
		if (l.id === excludeLegId) continue;
		const pp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				route_daily_plan_phase_driver_id: dropPdId,
				passenger_id: l.passenger_id,
				status: { in: ["PENDING", "ARRIVED", "STILL_WAITING"] },
			},
		});
		if (pp) return l;
	}
	return null;
}

/**
 * Passengers on this execution route still needing driver action in this phase.
 * Only `route_legs` for `routeId` are considered — avoids extra phase_passenger rows
 * (e.g. not on today’s route) blocking completion.
 */
export async function countBlockingPhasePassengersOnRoute(
	db: PrismaClient,
	routeId: number,
	routeDailyPlanId: number,
	phase: "PICKUP" | "DROP",
): Promise<number> {
	const pdId = await getPhaseDriverId(db, routeDailyPlanId, phase);
	if (!pdId) return 0;
	const legPassengers = await db.routeLeg.findMany({
		where: { route_id: routeId },
		select: { passenger_id: true },
	});
	const ids = [...new Set(legPassengers.map((x) => x.passenger_id))];
	if (ids.length === 0) return 0;
	return db.routeDailyPlanPhasePassenger.count({
		where: {
			route_daily_plan_phase_driver_id: pdId,
			passenger_id: { in: ids },
			status: { in: ["PENDING", "ARRIVED", "STILL_WAITING"] },
		},
	});
}

export async function countDropPendingOrArrivedInBatch(
	db: PrismaClient,
	routeId: number,
	batchId: number,
	routeDailyPlanId: number,
): Promise<number> {
	const dropPdId = await getPhaseDriverId(db, routeDailyPlanId, "DROP");
	if (!dropPdId) return 0;
	const legPassengers = await db.routeLeg.findMany({
		where: { route_id: routeId, batch_id: batchId },
		select: { passenger_id: true },
	});
	const ids = [...new Set(legPassengers.map((x) => x.passenger_id))];
	if (ids.length === 0) return 0;
	return db.routeDailyPlanPhasePassenger.count({
		where: {
			route_daily_plan_phase_driver_id: dropPdId,
			passenger_id: { in: ids },
			status: { in: ["PENDING", "ARRIVED", "STILL_WAITING"] },
		},
	});
}

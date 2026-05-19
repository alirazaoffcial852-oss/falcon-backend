import type { PrismaClient } from "../generated/prisma/client";
import { sortRouteLegsByPickupTime } from "./pickupSchedule";

/**
 * First pickup leg across the route (earliest pickup_time, then batch_order / sequence).
 */
export async function getFirstRouteLegInPickupOrder(
	prisma: PrismaClient,
	routeId: number,
) {
	const batches = await prisma.routeBatch.findMany({
		where: { route_id: routeId },
		orderBy: { batch_order: "asc" },
		include: { legs: true },
	});
	const allLegs = batches.flatMap((b) => b.legs);
	return sortRouteLegsByPickupTime(allLegs, "PICKUP")[0] ?? null;
}

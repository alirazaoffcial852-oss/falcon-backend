import type { PrismaClient } from "../generated/prisma/client";

/**
 * First pickup leg across the route: batches ascending `batch_order`, then legs ascending `sequence`.
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
	for (const b of batches) {
		const legs = [...b.legs].sort((a, b) => a.sequence - b.sequence);
		if (legs[0]) return legs[0];
	}
	return null;
}

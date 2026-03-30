import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type {
	CreateRouteInput,
	UpdateRouteInput,
	RouteListQuery,
} from "../types/admin/route";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import { fetchGoogleDirections, type LatLng } from "../utils/googleDirections";

export class RouteService {
	private db = DatabaseService.getInstance().getPrisma();

	private distanceKm(a: LatLng, b: LatLng): number {
		const R = 6371;
		const dLat = ((b.lat - a.lat) * Math.PI) / 180;
		const dLon = ((b.lng - a.lng) * Math.PI) / 180;
		const lat1 = (a.lat * Math.PI) / 180;
		const lat2 = (b.lat * Math.PI) / 180;
		const h =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1) *
				Math.cos(lat2) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	}

	private async optimizeAndStoreDirections(routeId: number): Promise<void> {
		const route = await this.db.route.findUnique({
			where: { id: routeId },
			include: {
				driver: true,
				legs: { orderBy: { id: "asc" } },
			},
		});
		if (!route || route.legs.length === 0) return;
		if (!process.env.GOOGLE_MAPS_API_KEY) return;

		const origin: LatLng =
			route.driver.current_lat !== null && route.driver.current_long !== null
				? { lat: route.driver.current_lat, lng: route.driver.current_long }
				: { lat: route.legs[0].pickup_lat, lng: route.legs[0].pickup_long };

		const destination: LatLng = {
			lat: route.office_lat,
			lng: route.office_long,
		};

		const rawWaypoints: Array<{ idx: number; point: LatLng }> = route.legs.map(
			(leg, idx) => ({
				idx,
				point: {
					lat: leg.pickup_lat,
					lng: leg.pickup_long,
				},
			}),
		);

		// Required behavior: pickup order must be from driver-origin (nearest-first),
		// not from office-optimized complete trip order.
		const orderedWaypoints = rawWaypoints
			.slice()
			.sort(
				(a, b) =>
					this.distanceKm(origin, a.point) - this.distanceKm(origin, b.point),
			);
		const waypointOrder = orderedWaypoints.map((w) => w.idx);
		const waypoints: LatLng[] = orderedWaypoints.map((w) => w.point);

		const directions = await fetchGoogleDirections({
			origin,
			destination,
			waypoints,
			optimizeWaypoints: false,
		});
		const polyline = directions.overview_polyline?.points ?? null;

		// Keep persisted order relative to original legs indexes
		await this.db.$transaction(async (tx) => {
			for (let idx = 0; idx < waypointOrder.length; idx++) {
				const originalWaypointIndex = waypointOrder[idx];
				const leg = route.legs[originalWaypointIndex];
				if (!leg) continue;
				await tx.routeLeg.update({
					where: { id: leg.id },
					data: { sequence: idx + 1 },
				});
			}

			const totalDistance = (directions.legs ?? []).reduce(
				(sum, leg) => sum + (leg.distance?.value ?? 0),
				0,
			);
			const totalDuration = (directions.legs ?? []).reduce(
				(sum, leg) => sum + (leg.duration?.value ?? 0),
				0,
			);

			await tx.route.update({
				where: { id: routeId },
				data: {
					directions_polyline: polyline,
					directions_waypoint_order: waypointOrder,
					directions_legs: (directions.legs ?? []).map((leg) => ({
						distance_meters: leg.distance?.value ?? 0,
						duration_seconds: leg.duration?.value ?? 0,
						start_address: leg.start_address ?? "",
						end_address: leg.end_address ?? "",
					})),
					directions_distance_meters: totalDistance,
					directions_duration_seconds: totalDuration,
					directions_updated_at: new Date(),
				},
			});
		});
	}

	async list(params: RouteListQuery) {
		const where = buildWhereCondition(params, ["office_address"], ["status"]);
		if (params.companyId !== undefined) where.company_id = params.companyId;
		if (params.driverId !== undefined) where.driver_id = params.driverId;

		const total = await this.db.route.count({ where });
		const data = await this.db.route.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
			include: {
				company: { select: { id: true, name: true } },
				driver: { select: { id: true, name: true } },
				legs: {
					include: {
						passenger: { select: { id: true, name: true } },
					},
				},
			},
		});
		return {
			data,
			pagination: {
				total,
				page: params.page,
				limit: params.limit,
				total_pages: Math.ceil(total / params.limit),
			},
		};
	}

	async getById(id: number) {
		const route = await this.db.route.findUnique({
			where: { id },
			include: {
				company: true,
				driver: true,
				legs: { include: { passenger: true } },
			},
		});
		if (!route)
			throw ResponseHandler.notFound("No route found against this id: " + id);
		return route;
	}

	async create(data: CreateRouteInput) {
		const route = await this.db.$transaction(async (tx) => {
			const created = await tx.route.create({
				data: {
					company_id: data.companyId,
					driver_id: data.driverId,
					office_address: data.officeAddress.trim(),
					office_lat: data.officeLat,
					office_long: data.officeLong,
					status: "PENDING",
					legs: {
						create: data.legs.map((leg) => ({
							passenger_id: leg.passengerId,
							pickup_address: leg.pickupAddress.trim(),
							pickup_lat: leg.pickupLat,
							pickup_long: leg.pickupLong,
							pickup_time: leg.pickupTime.trim(),
							dropoff_address: leg.dropoffAddress.trim(),
							dropoff_lat: leg.dropoffLat,
							dropoff_long: leg.dropoffLong,
							dropoff_time: leg.dropoffTime.trim(),
							toll_amount: leg.tollAmount ?? null,
						})),
					},
				},
				include: {
					company: { select: { id: true, name: true } },
					driver: { select: { id: true, name: true } },
					legs: {
						include: { passenger: { select: { id: true, name: true } } },
					},
				},
			});
			return created;
		});
		await this.optimizeAndStoreDirections(route.id);
		return this.getById(route.id);
	}

	async update(id: number, data: UpdateRouteInput) {
		await this.getById(id);

		if (data.legs !== undefined && data.legs.length > 0) {
			const legs = data.legs;
			await this.db.$transaction(async (tx) => {
				await tx.routeLeg.deleteMany({ where: { route_id: id } });
				await tx.route.update({
					where: { id },
					data: {
						...(data.companyId !== undefined && { company_id: data.companyId }),
						...(data.driverId !== undefined && { driver_id: data.driverId }),
						...(data.officeAddress !== undefined && {
							office_address: data.officeAddress.trim(),
						}),
						...(data.officeLat !== undefined && { office_lat: data.officeLat }),
						...(data.officeLong !== undefined && {
							office_long: data.officeLong,
						}),
						legs: {
							create: legs.map((leg) => ({
								passenger_id: leg.passengerId,
								pickup_address: leg.pickupAddress.trim(),
								pickup_lat: leg.pickupLat,
								pickup_long: leg.pickupLong,
								pickup_time: leg.pickupTime.trim(),
								dropoff_address: leg.dropoffAddress.trim(),
								dropoff_lat: leg.dropoffLat,
								dropoff_long: leg.dropoffLong,
								dropoff_time: leg.dropoffTime.trim(),
								toll_amount: leg.tollAmount ?? null,
							})),
						},
					},
				});
			});
			await this.optimizeAndStoreDirections(id);
		} else {
			await this.db.route.update({
				where: { id },
				data: {
					...(data.companyId !== undefined && { company_id: data.companyId }),
					...(data.driverId !== undefined && { driver_id: data.driverId }),
					...(data.officeAddress !== undefined && {
						office_address: data.officeAddress.trim(),
					}),
					...(data.officeLat !== undefined && { office_lat: data.officeLat }),
					...(data.officeLong !== undefined && {
						office_long: data.officeLong,
					}),
				},
			});
		}

		return this.getById(id);
	}

	async optimizeById(id: number) {
		await this.getById(id);
		await this.optimizeAndStoreDirections(id);
		return this.getById(id);
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.route.delete({ where: { id } });
	}
}

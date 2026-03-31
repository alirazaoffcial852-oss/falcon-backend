import { Prisma } from "../generated/prisma/client";
import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type {
	CreateRouteInput,
	UpdateRouteInput,
	RouteListQuery,
	RouteBatchInput,
} from "../types/admin/route";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import { fetchGoogleDirections, type LatLng } from "../utils/googleDirections";
import { geocodeAddressToLatLng } from "../utils/geocodeAddress";

type SortOriginMode = "driver_home" | "office";

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
			Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	}

	/** Nearest-first sort uses driver home (batch 1) or office (batch 2+). Polyline does NOT include this point. */
	private async ensureDriverHomeLatLng(driverId: number): Promise<LatLng> {
		const driver = await this.db.driver.findUnique({ where: { id: driverId } });
		if (!driver) throw ResponseHandler.notFound("Driver not found");
		if (driver.home_lat != null && driver.home_long != null) {
			return { lat: driver.home_lat, lng: driver.home_long };
		}
		const geo = await geocodeAddressToLatLng(driver.address);
		await this.db.driver.update({
			where: { id: driverId },
			data: { home_lat: geo.lat, home_long: geo.lng },
		});
		return geo;
	}

	private mapLegCreate(leg: RouteBatchInput["legs"][0]) {
		return {
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
		};
	}

	/**
	 * Pickup path: first pickup → … → office. Origin for Google = first pickup (driver home is NOT on the path).
	 * Sort order: nearest to sortOrigin (driver home for first batch, office for later batches).
	 */
	private async optimizeBatchPickup(
		batchId: number,
		sortOrigin: SortOriginMode,
		office: LatLng,
	): Promise<void> {
		const batch = await this.db.routeBatch.findUnique({
			where: { id: batchId },
			include: {
				route: { select: { id: true, driver_id: true } },
				legs: { orderBy: { id: "asc" } },
			},
		});
		if (!batch || batch.legs.length === 0) return;
		if (!process.env.GOOGLE_MAPS_API_KEY) return;

		let sortPoint: LatLng;
		if (sortOrigin === "driver_home") {
			sortPoint = await this.ensureDriverHomeLatLng(batch.route.driver_id);
		} else {
			sortPoint = office;
		}

		const rawWaypoints: Array<{ idx: number; point: LatLng }> = batch.legs.map(
			(leg, idx) => ({
				idx,
				point: { lat: leg.pickup_lat, lng: leg.pickup_long },
			}),
		);

		const orderedWaypoints = rawWaypoints
			.slice()
			.sort(
				(a, b) =>
					this.distanceKm(sortPoint, a.point) - this.distanceKm(sortPoint, b.point),
			);
		const waypointOrder = orderedWaypoints.map((w) => w.idx);
		const pickupPoints: LatLng[] = orderedWaypoints.map((w) => w.point);

		const origin: LatLng = pickupPoints[0];
		const destination: LatLng = office;
		const waypoints: LatLng[] =
			pickupPoints.length > 1 ? pickupPoints.slice(1) : [];

		const finalDirections = await fetchGoogleDirections({
			origin,
			destination,
			waypoints,
			optimizeWaypoints: false,
		});

		const polyline = finalDirections.overview_polyline?.points ?? null;
		const totalDistance = (finalDirections.legs ?? []).reduce(
			(sum, leg) => sum + (leg.distance?.value ?? 0),
			0,
		);
		const totalDuration = (finalDirections.legs ?? []).reduce(
			(sum, leg) => sum + (leg.duration?.value ?? 0),
			0,
		);

		await this.db.$transaction(async (tx) => {
			for (let idx = 0; idx < waypointOrder.length; idx++) {
				const origIdx = waypointOrder[idx];
				const leg = batch.legs[origIdx];
				if (!leg) continue;
				await tx.routeLeg.update({
					where: { id: leg.id },
					data: { sequence: idx + 1 },
				});
			}

			await tx.routeBatch.update({
				where: { id: batchId },
				data: {
					pickup_directions_polyline: polyline,
					pickup_waypoint_order: waypointOrder,
					pickup_directions_legs: (finalDirections.legs ?? []).map((leg) => ({
						distance_meters: leg.distance?.value ?? 0,
						duration_seconds: leg.duration?.value ?? 0,
						start_address: leg.start_address ?? "",
						end_address: leg.end_address ?? "",
					})),
					pickup_distance_meters: totalDistance,
					pickup_duration_seconds: totalDuration,
					pickup_updated_at: new Date(),
				},
			});
		});
	}

	/** Drop path: office → homes in reverse pickup order (last picked = first dropped). */
	private async optimizeBatchDrop(batchId: number, office: LatLng): Promise<void> {
		const batch = await this.db.routeBatch.findUnique({
			where: { id: batchId },
			include: {
				legs: { orderBy: { sequence: "desc" } },
			},
		});
		if (!batch || batch.legs.length === 0) return;
		if (!process.env.GOOGLE_MAPS_API_KEY) return;

		for (let i = 0; i < batch.legs.length; i++) {
			await this.db.routeLeg.update({
				where: { id: batch.legs[i].id },
				data: { drop_sequence: i + 1 },
			});
		}

		const reloaded = await this.db.routeBatch.findUnique({
			where: { id: batchId },
			include: { legs: { orderBy: { drop_sequence: "asc" } } },
		});
		if (!reloaded) return;

		const orderedHomes = reloaded.legs.map((leg) => ({
			lat: leg.dropoff_lat,
			lng: leg.dropoff_long,
		}));

		const origin = office;
		let finalDirections;
		if (orderedHomes.length === 1) {
			finalDirections = await fetchGoogleDirections({
				origin,
				destination: orderedHomes[0],
				waypoints: [],
				optimizeWaypoints: false,
			});
		} else {
			finalDirections = await fetchGoogleDirections({
				origin,
				destination: orderedHomes[orderedHomes.length - 1]!,
				waypoints: orderedHomes.slice(0, -1),
				optimizeWaypoints: false,
			});
		}

		const polyline = finalDirections.overview_polyline?.points ?? null;
		const waypointOrder = reloaded.legs.map((_, i) => i);
		const totalDistance = (finalDirections.legs ?? []).reduce(
			(sum, leg) => sum + (leg.distance?.value ?? 0),
			0,
		);
		const totalDuration = (finalDirections.legs ?? []).reduce(
			(sum, leg) => sum + (leg.duration?.value ?? 0),
			0,
		);

		await this.db.routeBatch.update({
			where: { id: batchId },
			data: {
				drop_directions_polyline: polyline,
				drop_waypoint_order: waypointOrder,
				drop_directions_legs: (finalDirections.legs ?? []).map((leg) => ({
					distance_meters: leg.distance?.value ?? 0,
					duration_seconds: leg.duration?.value ?? 0,
					start_address: leg.start_address ?? "",
					end_address: leg.end_address ?? "",
				})),
				drop_distance_meters: totalDistance,
				drop_duration_seconds: totalDuration,
				drop_updated_at: new Date(),
			},
		});
	}

	private async optimizeAllBatches(routeId: number): Promise<void> {
		const route = await this.db.route.findUnique({
			where: { id: routeId },
			include: { batches: { orderBy: { batch_order: "asc" } } },
		});
		if (!route) return;
		const office: LatLng = {
			lat: route.office_lat,
			lng: route.office_long,
		};

		for (const b of route.batches) {
			const sortOrigin: SortOriginMode =
				b.batch_order === 1 ? "driver_home" : "office";
			await this.optimizeBatchPickup(b.id, sortOrigin, office);
			await this.optimizeBatchDrop(b.id, office);
		}

		await this.syncRouteLegacyDirectionsFromBatch(routeId);
	}

	/** Keep Route.directions_* in sync with batch 1 pickup for admin list / older clients. */
	private async syncRouteLegacyDirectionsFromBatch(routeId: number): Promise<void> {
		const route = await this.db.route.findUnique({
			where: { id: routeId },
			include: { batches: { orderBy: { batch_order: "asc" }, take: 1 } },
		});
		const first = route?.batches[0];
		if (!first) return;
		await this.db.route.update({
			where: { id: routeId },
			data: {
				directions_polyline: first.pickup_directions_polyline,
				directions_waypoint_order: first.pickup_waypoint_order as Prisma.InputJsonValue,
				directions_legs: first.pickup_directions_legs as Prisma.InputJsonValue,
				directions_distance_meters: first.pickup_distance_meters,
				directions_duration_seconds: first.pickup_duration_seconds,
				directions_updated_at: first.pickup_updated_at,
			},
		});
	}

	private normalizeCreateBatches(
		data: CreateRouteInput & { legs?: RouteBatchInput["legs"] },
	): RouteBatchInput[] {
		if (data.batches?.length) return data.batches;
		const legs = (data as { legs?: RouteBatchInput["legs"] }).legs;
		if (legs?.length) return [{ legs }];
		throw ResponseHandler.badRequest(
			"Provide batches (array) or legacy legs array",
		);
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
				batches: {
					orderBy: { batch_order: "asc" },
					include: {
						legs: {
							include: {
								passenger: { select: { id: true, name: true } },
							},
						},
					},
				},
				segments: { orderBy: { segment_order: "asc" } },
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
				batches: {
					orderBy: { batch_order: "asc" },
					include: { legs: { include: { passenger: true } } },
				},
				segments: {
					orderBy: { segment_order: "asc" },
					include: { batch: true },
				},
				legs: { include: { passenger: true } },
			},
		});
		if (!route)
			throw ResponseHandler.notFound("No route found against this id: " + id);
		return route;
	}

	async create(data: CreateRouteInput & { legs?: RouteBatchInput["legs"] }) {
		const batchInputs = this.normalizeCreateBatches(data);

		const route = await this.db.$transaction(async (tx) => {
			const created = await tx.route.create({
				data: {
					company_id: data.companyId,
					driver_id: data.driverId,
					office_address: data.officeAddress.trim(),
					office_lat: data.officeLat,
					office_long: data.officeLong,
					status: "PENDING",
				},
			});

			const batchesOrdered = [];
			for (let bi = 0; bi < batchInputs.length; bi++) {
				const batch = batchInputs[bi];
				const b = await tx.routeBatch.create({
					data: {
						route_id: created.id,
						batch_order: bi + 1,
						legs: {
							create: batch.legs.map((leg) => ({
								route_id: created.id,
								...this.mapLegCreate(leg),
							})),
						},
					},
				});
				batchesOrdered.push(b);
			}

			let segmentOrder = 0;
			for (const b of batchesOrdered) {
				await tx.routeSegment.create({
					data: {
						route_id: created.id,
						segment_order: segmentOrder++,
						batch_id: b.id,
						kind: "PICKUP_TO_OFFICE",
						status: "PENDING",
					},
				});
			}
			for (const b of batchesOrdered) {
				await tx.routeSegment.create({
					data: {
						route_id: created.id,
						segment_order: segmentOrder++,
						batch_id: b.id,
						kind: "DROP_TO_HOMES",
						status: "PENDING",
					},
				});
			}

			return created;
		});

		await this.optimizeAllBatches(route.id);
		return this.getById(route.id);
	}

	async update(id: number, data: UpdateRouteInput) {
		await this.getById(id);

		if (data.batches !== undefined && data.batches.length > 0) {
			const batchInputs = data.batches;
			await this.db.$transaction(async (tx) => {
				await tx.routeSegment.deleteMany({ where: { route_id: id } });
				await tx.routeLeg.deleteMany({ where: { route_id: id } });
				await tx.routeBatch.deleteMany({ where: { route_id: id } });

				for (let bi = 0; bi < batchInputs.length; bi++) {
					const batch = batchInputs[bi];
					await tx.routeBatch.create({
						data: {
							route_id: id,
							batch_order: bi + 1,
							legs: {
								create: batch.legs.map((leg) => ({
									route_id: id,
									...this.mapLegCreate(leg),
								})),
							},
						},
					});
				}

				const batchesOrdered = await tx.routeBatch.findMany({
					where: { route_id: id },
					orderBy: { batch_order: "asc" },
				});
				let segmentOrder = 0;
				for (const b of batchesOrdered) {
					await tx.routeSegment.create({
						data: {
							route_id: id,
							segment_order: segmentOrder++,
							batch_id: b.id,
							kind: "PICKUP_TO_OFFICE",
							status: "PENDING",
						},
					});
				}
				for (const b of batchesOrdered) {
					await tx.routeSegment.create({
						data: {
							route_id: id,
							segment_order: segmentOrder++,
							batch_id: b.id,
							kind: "DROP_TO_HOMES",
							status: "PENDING",
						},
					});
				}

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
					},
				});
			});
			await this.optimizeAllBatches(id);
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
		await this.optimizeAllBatches(id);
		return this.getById(id);
	}

	/**
	 * Copies the ONGOING segment's cached directions onto Route.directions_* for mobile clients.
	 */
	async syncRouteDisplayDirections(routeId: number): Promise<void> {
		const seg = await this.db.routeSegment.findFirst({
			where: { route_id: routeId, status: "ONGOING" },
			include: { batch: true },
		});
		if (!seg) return;
		const b = seg.batch;
		const pickup = seg.kind === "PICKUP_TO_OFFICE";
		await this.db.route.update({
			where: { id: routeId },
			data: {
				directions_polyline: pickup
					? b.pickup_directions_polyline
					: b.drop_directions_polyline,
				directions_waypoint_order: (pickup
					? b.pickup_waypoint_order
					: b.drop_waypoint_order) as Prisma.InputJsonValue,
				directions_legs: (pickup
					? b.pickup_directions_legs
					: b.drop_directions_legs) as Prisma.InputJsonValue,
				directions_distance_meters: pickup
					? b.pickup_distance_meters
					: b.drop_distance_meters,
				directions_duration_seconds: pickup
					? b.pickup_duration_seconds
					: b.drop_duration_seconds,
				directions_updated_at: pickup
					? b.pickup_updated_at
					: b.drop_updated_at,
			},
		});
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.route.delete({ where: { id } });
	}
}

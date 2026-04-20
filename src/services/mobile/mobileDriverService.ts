import { DatabaseService } from "../../config/database";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import {
	emitToDriver,
	emitToPassenger,
	emitToPassengers,
	emitToAdmins,
} from "../../config/socketService";
import type { LegAction } from "../../types/mobile/driver";
import {
	getDriverLiveLocation,
	setDriverLiveLocation,
} from "../../utils/liveLocationStore";
import { notificationService } from "../notificationService";
import {
	dailyPlanForActiveDayWhere,
	phaseDriverScheduledDateWhere,
} from "../../utils/routeDayScope";
import { getFirstRouteLegInPickupOrder } from "../../utils/routeFirstPickupLeg";
import { parseTimeToMinutesFromMidnight } from "../../utils/pickupSchedule";
import {
	getRouteDailyPlanId,
	updatePhasePassengerRow,
	getPhaseStatusMapByPassengerId,
	getPickupPhasePassengerExtrasByPassengerId,
	findNextPickupLegInBatch,
	countPickupPendingOrArrivedInBatch,
	findNextDropLegInBatch,
	countDropPendingOrArrivedInBatch,
	countBlockingPhasePassengersOnRoute,
} from "../../utils/phasePassengerHelpers";

const db = DatabaseService.getInstance().getPrisma();

// ---------- helpers ----------

function haversineKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveDriver(userId: number) {
	const driver = await db.driver.findUnique({
		where: { user_id: userId },
		select: {
			id: true,
			user_id: true,
			name: true,
			phone_no: true,
			address: true,
			driver_image_url: true,
			is_available: true,
			available_at: true,
			user: { select: { email: true } },
		},
	});
	if (!driver) throw ResponseHandler.notFound("Driver profile not found");
	return driver;
}

function distanceKmForLeg(
	driver: { current_lat: number | null; current_long: number | null },
	leg: {
		pickup_lat: number;
		pickup_long: number;
		dropoff_lat: number;
		dropoff_long: number;
	},
	isPickup: boolean,
): string | null {
	if (driver.current_lat === null || driver.current_long === null) return null;
	const lat = isPickup ? leg.pickup_lat : leg.dropoff_lat;
	const lng = isPickup ? leg.pickup_long : leg.dropoff_long;
	return haversineKm(driver.current_lat, driver.current_long, lat, lng).toFixed(
		2,
	);
}

function getDriverLocationSnapshot(driverId: number): {
	current_lat: number | null;
	current_long: number | null;
	location_updated_at: Date | null;
} {
	const loc = getDriverLiveLocation(driverId);
	return {
		current_lat: loc?.lat ?? null,
		current_long: loc?.long ?? null,
		location_updated_at: loc?.updated_at ?? null,
	};
}

async function getCurrentFuelPricePerLiter(): Promise<number> {
	const now = new Date();
	const fuelPrice = await db.fuelPrice.findFirst({
		where: { effective_from: { lte: now } },
		orderBy: [{ effective_from: "desc" }, { id: "desc" }],
		select: { price_per_liter: true },
	});
	if (!fuelPrice) {
		throw ResponseHandler.badRequest(
			"Fuel price is not configured. Ask admin to add current fuel price.",
		);
	}
	return Number(fuelPrice.price_per_liter);
}

const MAX_SEGMENT_SYNC_STEPS = 64;

/** Same DB updates as `officeCheckpoint` after pickups in batch are cleared. */
async function runPickupOfficeAdvanceCore(
	routeId: number,
	routePlanId: number,
	seg: { id: number },
): Promise<{ kind: "PICKUP_TO_OFFICE" | "DROP_TO_HOMES"; batch_id: number }> {
	await db.routeSegment.update({
		where: { id: seg.id },
		data: { status: "COMPLETED" },
	});
	const nextSeg = await db.routeSegment.findFirst({
		where: { route_id: routeId, status: "PENDING" },
		orderBy: { segment_order: "asc" },
	});
	if (!nextSeg) {
		throw ResponseHandler.badRequest("No next segment");
	}
	await db.routeSegment.update({
		where: { id: nextSeg.id },
		data: { status: "ONGOING" },
	});
	if (nextSeg.kind === "DROP_TO_HOMES") {
		const execForPlan = await db.route.findUnique({
			where: { id: routeId },
			select: { route_daily_plan_id: true },
		});
		if (execForPlan?.route_daily_plan_id) {
			const firstPickupLeg = await getFirstRouteLegInPickupOrder(db, routeId);
			const plannedDropTime =
				firstPickupLeg?.office_pick_up_time?.trim() ?? null;
			await db.routeDailyPlanPhaseDriver.updateMany({
				where: {
					route_daily_plan_id: execForPlan.route_daily_plan_id,
					phase: "DROP",
				},
				data: {
					trip_start_time: plannedDropTime,
					trip_started_at: new Date(),
					status: "ONGOING",
				},
			});
		}
	}
	return { kind: nextSeg.kind, batch_id: nextSeg.batch_id };
}

/** Same as last drop in batch in `legAction` when all passengers are dropped. */
async function runDropSegmentAdvanceCore(
	routeId: number,
	seg: { id: number },
): Promise<void> {
	await db.routeSegment.update({
		where: { id: seg.id },
		data: { status: "COMPLETED" },
	});
	const nextSeg = await db.routeSegment.findFirst({
		where: { route_id: routeId, status: "PENDING" },
		orderBy: { segment_order: "asc" },
	});
	if (nextSeg) {
		await db.routeSegment.update({
			where: { id: nextSeg.id },
			data: { status: "ONGOING" },
		});
	}
}

async function tryAdvancePickupOfficeForComplete(
	routeId: number,
	routePlanId: number,
): Promise<boolean> {
	const seg = await db.routeSegment.findFirst({
		where: { route_id: routeId, status: "ONGOING", kind: "PICKUP_TO_OFFICE" },
	});
	if (!seg) return false;
	const pending = await countPickupPendingOrArrivedInBatch(
		db,
		routeId,
		seg.batch_id,
		routePlanId,
	);
	if (pending > 0) {
		throw ResponseHandler.badRequest(
			"Complete all pickups in the current batch before finishing the trip.",
		);
	}
	await runPickupOfficeAdvanceCore(routeId, routePlanId, seg);
	return true;
}

async function tryAdvanceDropForComplete(
	routeId: number,
	routePlanId: number,
): Promise<boolean> {
	const seg = await db.routeSegment.findFirst({
		where: { route_id: routeId, status: "ONGOING", kind: "DROP_TO_HOMES" },
	});
	if (!seg) return false;
	const pending = await countDropPendingOrArrivedInBatch(
		db,
		routeId,
		seg.batch_id,
		routePlanId,
	);
	if (pending > 0) {
		throw ResponseHandler.badRequest(
			"Complete all drop-offs before finishing the trip.",
		);
	}
	await runDropSegmentAdvanceCore(routeId, seg);
	return true;
}

/**
 * Applies office-checkpoint + between-batch transitions without calling the checkpoint HTTP API,
 * until all segments are COMPLETED or progress is blocked by incomplete passenger actions.
 */
async function syncRouteSegmentsForTripCompletion(
	routeId: number,
	routePlanId: number,
): Promise<void> {
	for (let step = 0; step < MAX_SEGMENT_SYNC_STEPS; step++) {
		const incomplete = await db.routeSegment.count({
			where: { route_id: routeId, status: { not: "COMPLETED" } },
		});
		if (incomplete === 0) return;

		if (await tryAdvancePickupOfficeForComplete(routeId, routePlanId)) continue;
		if (await tryAdvanceDropForComplete(routeId, routePlanId)) continue;

		const nextPending = await db.routeSegment.findFirst({
			where: { route_id: routeId, status: "PENDING" },
			orderBy: { segment_order: "asc" },
		});
		if (nextPending) {
			await db.routeSegment.update({
				where: { id: nextPending.id },
				data: { status: "ONGOING" },
			});
			continue;
		}

		throw ResponseHandler.badRequest(
			"Cannot finish the trip: route segments are in an inconsistent state.",
		);
	}
	throw ResponseHandler.badRequest(
		"Cannot finish the trip: too many segment steps (contact support).",
	);
}

/** Advances only pickup-to-office segments (no drop completion). Used when completing the PICKUP phase. */
async function syncPickupSegmentsOnly(
	routeId: number,
	routePlanId: number,
): Promise<void> {
	for (let step = 0; step < MAX_SEGMENT_SYNC_STEPS; step++) {
		const incompletePickup = await db.routeSegment.count({
			where: {
				route_id: routeId,
				kind: "PICKUP_TO_OFFICE",
				status: { not: "COMPLETED" },
			},
		});
		if (incompletePickup === 0) return;

		if (await tryAdvancePickupOfficeForComplete(routeId, routePlanId)) continue;

		const nextPendingPickup = await db.routeSegment.findFirst({
			where: { route_id: routeId, kind: "PICKUP_TO_OFFICE", status: "PENDING" },
			orderBy: { segment_order: "asc" },
		});
		if (nextPendingPickup) {
			await db.routeSegment.update({
				where: { id: nextPendingPickup.id },
				data: { status: "ONGOING" },
			});
			continue;
		}

		const pickupOngoing = await db.routeSegment.findFirst({
			where: { route_id: routeId, status: "ONGOING", kind: "PICKUP_TO_OFFICE" },
		});
		if (pickupOngoing) {
			const pending = await countPickupPendingOrArrivedInBatch(
				db,
				routeId,
				pickupOngoing.batch_id,
				routePlanId,
			);
			if (pending > 0) {
				throw ResponseHandler.badRequest(
					"Complete all pickups in the current batch before completing the pickup phase.",
				);
			}
		}

		throw ResponseHandler.badRequest(
			"Cannot finish pickup phase: route segments are in an inconsistent state.",
		);
	}
	throw ResponseHandler.badRequest(
		"Cannot finish pickup phase: too many segment steps (contact support).",
	);
}

/** Polyline + meta for display: ONGOING segment, else first segment preview. */
async function getDisplayDirectionsForRoute(routeId: number) {
	const ongoing = await db.routeSegment.findFirst({
		where: { route_id: routeId, status: "ONGOING" },
		include: { batch: true },
	});
	const seg = ongoing
		? ongoing
		: await db.routeSegment.findFirst({
				where: { route_id: routeId, segment_order: 0 },
				include: { batch: true },
			});
	if (!seg) return null;
	const b = seg.batch;
	const pickup = seg.kind === "PICKUP_TO_OFFICE";
	return {
		directions_polyline: pickup
			? b.pickup_directions_polyline
			: b.drop_directions_polyline,
		directions_waypoint_order: pickup
			? b.pickup_waypoint_order
			: b.drop_waypoint_order,
		directions_legs: pickup ? b.pickup_directions_legs : b.drop_directions_legs,
		directions_distance_meters: pickup
			? b.pickup_distance_meters
			: b.drop_distance_meters,
		directions_duration_seconds: pickup
			? b.pickup_duration_seconds
			: b.drop_duration_seconds,
		directions_updated_at: pickup ? b.pickup_updated_at : b.drop_updated_at,
		execution_kind: seg.kind,
		batch_id: seg.batch_id,
	};
}

function buildQueueItem(
	leg: {
		id: number;
		sequence: number;
		drop_sequence: number;
		pickup_address: string;
		pickup_lat: number;
		pickup_long: number;
		pickup_time: string;
		dropoff_address: string;
		dropoff_lat: number;
		dropoff_long: number;
		dropoff_time: string;
		passenger: { id: number; name: string; phone_no: string };
	},
	idx: number,
	isPickup: boolean,
	driver: { current_lat: number | null; current_long: number | null },
	pickupPhaseStatus: string,
	dropPhaseStatus: string,
	pickupPassengerAck: string | null,
) {
	const base = {
		queue_position: idx + 1,
		leg_id: leg.id,
		sequence: leg.sequence,
		drop_sequence: leg.drop_sequence,
		passenger: {
			id: leg.passenger.id,
			name: leg.passenger.name,
			phone_no: leg.passenger.phone_no,
		},
		execution_phase: isPickup ? ("PICKUP" as const) : ("DROP" as const),
	};
	if (isPickup) {
		return {
			...base,
			pickup_address: leg.pickup_address,
			pickup_lat: leg.pickup_lat,
			pickup_long: leg.pickup_long,
			pickup_time: leg.pickup_time,
			pickup_status: pickupPhaseStatus,
			passenger_ack: pickupPassengerAck,
			stop_address: leg.pickup_address,
			stop_lat: leg.pickup_lat,
			stop_long: leg.pickup_long,
			distance_km: distanceKmForLeg(driver, leg, true),
		};
	}
	return {
		...base,
		dropoff_address: leg.dropoff_address,
		dropoff_lat: leg.dropoff_lat,
		dropoff_long: leg.dropoff_long,
		dropoff_time: leg.dropoff_time,
		dropoff_status: dropPhaseStatus,
		stop_address: leg.dropoff_address,
		stop_lat: leg.dropoff_lat,
		stop_long: leg.dropoff_long,
		distance_km: distanceKmForLeg(driver, leg, false),
	};
}

type StartTripRouteLeg = {
	id: number;
	passenger_id: number;
	sequence: number;
	drop_sequence: number;
	pickup_address: string;
	pickup_lat: number;
	pickup_long: number;
	pickup_time: string;
	dropoff_address: string;
	dropoff_lat: number;
	dropoff_long: number;
	dropoff_time: string;
	passenger: { id: number; name: string; phone_no: string };
};

async function buildStartTripResponse(params: {
	routeId: number;
	planId: number;
	phaseDriverId: number;
	phase: "PICKUP" | "DROP";
	driver: { id: number; name: string };
	driverLive: {
		current_lat: number | null;
		current_long: number | null;
		location_updated_at: Date | null;
	};
}) {
	const { routeId, planId, phaseDriverId, phase, driver, driverLive } = params;
	const isPickup = phase === "PICKUP";

	const startedRoute = await db.route.findUnique({
		where: { id: routeId },
		include: {
			daily_plan: true,
			legs: {
				include: {
					passenger: { select: { id: true, name: true, phone_no: true } },
				},
				orderBy: { sequence: "asc" },
			},
			segments: { orderBy: { segment_order: "asc" } },
			batches: {
				orderBy: { batch_order: "asc" },
				include: {
					legs: {
						include: {
							passenger: { select: { id: true, name: true, phone_no: true } },
						},
					},
				},
			},
		},
	});
	if (!startedRoute) {
		throw ResponseHandler.notFound("Route not found after start");
	}

	const config = await db.driverConfiguration.findFirst();

	const activeSeg = isPickup
		? (startedRoute.segments.find(
				(s) => s.kind === "PICKUP_TO_OFFICE" && s.status === "ONGOING",
			) ?? startedRoute.segments.find((s) => s.kind === "PICKUP_TO_OFFICE"))
		: (startedRoute.segments.find(
				(s) => s.kind === "DROP_TO_HOMES" && s.status === "ONGOING",
			) ?? startedRoute.segments.find((s) => s.kind === "DROP_TO_HOMES"));

	const activeBatch = activeSeg
		? startedRoute.batches.find((b) => b.id === activeSeg.batch_id)
		: null;

	const sortedLegs: StartTripRouteLeg[] = activeBatch?.legs.length
		? [...activeBatch.legs].sort((a, b) =>
				isPickup ? a.sequence - b.sequence : a.drop_sequence - b.drop_sequence,
			)
		: [...startedRoute.legs].sort((a, b) =>
				isPickup ? a.sequence - b.sequence : a.drop_sequence - b.drop_sequence,
			);

	const pickupStatusMap = await getPhaseStatusMapByPassengerId(
		db,
		planId,
		"PICKUP",
	);
	const dropStatusMap = await getPhaseStatusMapByPassengerId(
		db,
		planId,
		"DROP",
	);
	const pickupExtras = await getPickupPhasePassengerExtrasByPassengerId(
		db,
		planId,
	);

	const queue = sortedLegs
		.filter((l) => {
			if (isPickup) {
				const st = pickupStatusMap.get(l.passenger_id);
				return st === "PENDING" || st === "ARRIVED" || st === "STILL_WAITING";
			}
			const st = dropStatusMap.get(l.passenger_id);
			return st === "PENDING" || st === "ARRIVED" || st === "STILL_WAITING";
		})
		.map((leg, idx) =>
			buildQueueItem(
				leg,
				idx,
				isPickup,
				driverLive,
				pickupStatusMap.get(leg.passenger_id) ?? "PENDING",
				dropStatusMap.get(leg.passenger_id) ?? "PENDING",
				pickupExtras.get(leg.passenger_id)?.passenger_ack ?? null,
			),
		);

	const dir = await getDisplayDirectionsForRoute(routeId);
	const firstLeg = sortedLegs[0];

	const executionKind =
		activeSeg?.kind ?? (isPickup ? "PICKUP_TO_OFFICE" : "DROP_TO_HOMES");

	return {
		phase_driver_id: phaseDriverId,
		route: {
			id: startedRoute.id,
			plan_id: startedRoute.daily_plan?.id,
			status: startedRoute.daily_plan?.status,
			office_address: startedRoute.office_address,
			office_lat: startedRoute.office_lat,
			office_long: startedRoute.office_long,
			started_at: startedRoute.daily_plan?.started_at,
			directions_polyline: dir?.directions_polyline ?? null,
			directions_waypoint_order: dir?.directions_waypoint_order ?? null,
			directions_legs: dir?.directions_legs ?? null,
			directions_distance_meters: dir?.directions_distance_meters ?? null,
			directions_duration_seconds: dir?.directions_duration_seconds ?? null,
			directions_updated_at: dir?.directions_updated_at ?? null,
			execution_kind: executionKind,
			passengers_queue: queue,
		},
		first_passenger: firstLeg
			? isPickup
				? {
						leg_id: firstLeg.id,
						passenger: {
							id: firstLeg.passenger.id,
							name: firstLeg.passenger.name,
						},
						pickup_address: firstLeg.pickup_address,
						pickup_lat: firstLeg.pickup_lat,
						pickup_long: firstLeg.pickup_long,
					}
				: {
						leg_id: firstLeg.id,
						passenger: {
							id: firstLeg.passenger.id,
							name: firstLeg.passenger.name,
						},
						dropoff_address: firstLeg.dropoff_address,
						dropoff_lat: firstLeg.dropoff_lat,
						dropoff_long: firstLeg.dropoff_long,
					}
			: null,
		config,
	};
}

// ---------- service ----------

export const MobileDriverService = {
	async getMyCars(userId: number) {
		const driver = await resolveDriver(userId);
		const rows = await db.driverAssignCar.findMany({
			where: { driver_id: driver.id },
			orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
			select: {
				id: true,
				car_id: true,
				is_default: true,
				car: {
					select: {
						id: true,
						name: true,
						car_no: true,
						car_color: true,
						model: true,
						engine_capacity: true,
						fuel_per_km: true,
					},
				},
			},
		});

		return {
			driver: { id: driver.id, name: driver.name },
			default_car_id:
				rows.find((x) => x.is_default)?.car_id ?? rows[0]?.car_id ?? null,
			cars: rows.map((x) => ({
				driver_assign_car_id: x.id,
				car_id: x.car_id,
				is_default: x.is_default,
				car: x.car,
			})),
		};
	},

	async getStats(userId: number, from?: Date, to?: Date) {
		const driver = await resolveDriver(userId);
		const whereDate: { gte?: Date; lte?: Date } = {};
		if (from) whereDate.gte = from;
		if (to) whereDate.lte = to;

		const dropPhases = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				driver_id: driver.id,
				phase: "DROP",
				status: "COMPLETED",
				...(from || to ? { scheduled_date: whereDate } : {}),
				route_daily_plan: { status: "COMPLETED" },
			},
			include: {
				route_daily_plan: {
					include: {
						definition_route: {
							select: {
								id: true,
								batches: {
									select: {
										pickup_distance_meters: true,
										drop_distance_meters: true,
										pickup_duration_seconds: true,
										drop_duration_seconds: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: { scheduled_date: "asc" },
		});

		const byDate = new Map<
			string,
			{ total_distance_meters: number; total_duration_seconds: number }
		>();

		for (const phase of dropPhases) {
			const key = phase.scheduled_date.toISOString().slice(0, 10);
			const current = byDate.get(key) ?? {
				total_distance_meters: 0,
				total_duration_seconds: 0,
			};
			const batches = phase.route_daily_plan.definition_route.batches;
			for (const b of batches) {
				current.total_distance_meters +=
					(b.pickup_distance_meters ?? 0) + (b.drop_distance_meters ?? 0);
				current.total_duration_seconds +=
					(b.pickup_duration_seconds ?? 0) + (b.drop_duration_seconds ?? 0);
			}
			byDate.set(key, current);
		}

		const rows = [...byDate.entries()]
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([date, v]) => {
				const km = v.total_distance_meters / 1000;
				const mins = Math.round(v.total_duration_seconds / 60);
				return {
					date,
					total_driven_km: Number(km.toFixed(2)),
					total_driven_label: `${Number(km.toFixed(2))} km`,
					total_time_minutes: mins,
					total_time_label: `${mins} min`,
				};
			});

		return {
			driver: { id: driver.id, name: driver.name },
			from: from ?? null,
			to: to ?? null,
			rows,
		};
	},

	async goAvailable(userId: number) {
		const driver = await resolveDriver(userId);
		const driverLive = getDriverLocationSnapshot(driver.id);

		const config = await db.driverConfiguration.findFirst();
		if (!config)
			throw ResponseHandler.notFound("Driver configuration not found");

		const updatedDriver = await db.driver.update({
			where: { id: driver.id },
			data: {
				is_available: true,
				available_at: new Date(),
			},
		});

		const plans = await db.routeDailyPlan.findMany({
			where: {
				definition_route: { driver_id: driver.id },
				status: "PENDING",
				...dailyPlanForActiveDayWhere(),
			},
			include: {
				execution_route: {
					select: {
						id: true,
						legs: { select: { passenger_id: true } },
					},
				},
			},
			orderBy: { id: "desc" },
		});

		for (const plan of plans) {
			const route = plan.execution_route;
			if (!route) continue;
			const passengerIds = route.legs.map((l) => l.passenger_id);
			emitToPassengers(passengerIds, "driver:available", {
				driverId: driver.id,
				driverName: driver.name,
				routeId: route.id,
				availableAt: updatedDriver.available_at,
				config: {
					remaining_start_time: config.remaining_start_time,
					availability_time: config.availability_time,
				},
			});
			void notificationService.sendToPassengerIds(passengerIds, {
				title: "Driver Available",
				body: `${driver.name} is now available`,
				data: { routeId: String(route.id), type: "driver_available" },
			});
		}

		return {
			driver: {
				id: updatedDriver.id,
				is_available: updatedDriver.is_available,
				available_at: updatedDriver.available_at,
			},
			config: {
				availability_time: config.availability_time,
				remaining_start_time: config.remaining_start_time,
			},
		};
	},

	async getSession(userId: number, phaseDriverId?: number) {
		const driver = await resolveDriver(userId);
		const driverLive = getDriverLocationSnapshot(driver.id);
		const config = await db.driverConfiguration.findFirst();

		const phaseRows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				driver_id: driver.id,
				...(phaseDriverId != null ? { id: phaseDriverId } : {}),
				scheduled_date: phaseDriverScheduledDateWhere(),
				status: { not: "COMPLETED" },
			},
			include: {
				route_daily_plan: {
					include: {
						execution_route: {
							select: {
								id: true,
								office_address: true,
								office_lat: true,
								office_long: true,
								batches: {
									orderBy: { batch_order: "asc" },
									select: {
										id: true,
										batch_order: true,
										// Pickup directions cache
										pickup_directions_polyline: true,
										pickup_waypoint_order: true,
										pickup_directions_legs: true,
										pickup_distance_meters: true,
										pickup_duration_seconds: true,
										// Drop directions cache
										drop_directions_polyline: true,
										drop_waypoint_order: true,
										drop_directions_legs: true,
										drop_distance_meters: true,
										drop_duration_seconds: true,
									},
								},
							},
						},
					},
				},
				route_daily_plan_phase_passengers: {
					include: {
						passenger: {
							select: {
								id: true,
								name: true,
								phone_no: true,
							},
						},
					},
				},
			},
		});

		const sorted = [...phaseRows].sort((a, b) => {
			const ma = parseTimeToMinutesFromMidnight(a.trip_start_time);
			const mb = parseTimeToMinutesFromMidnight(b.trip_start_time);
			if (ma !== null && mb !== null && ma !== mb) return ma - mb;
			if (ma === null && mb !== null) return 1;
			if (mb === null && ma !== null) return -1;
			if (a.route_daily_plan_id !== b.route_daily_plan_id) {
				return a.route_daily_plan_id - b.route_daily_plan_id;
			}
			// Same daily plan: PICKUP row before DROP
			if (a.phase === "PICKUP" && b.phase === "DROP") return -1;
			if (a.phase === "DROP" && b.phase === "PICKUP") return 1;
			return 0;
		});

		const executionRouteIds = [
			...new Set(
				sorted
					.map((pd) => pd.route_daily_plan.execution_route?.id)
					.filter((id): id is number => id != null),
			),
		];
		const routeLegs =
			executionRouteIds.length === 0
				? []
				: await db.routeLeg.findMany({
						where: { route_id: { in: executionRouteIds } },
						select: {
							route_id: true,
							passenger_id: true,
							pickup_lat: true,
							pickup_long: true,
							pickup_address: true,
							pickup_time: true,
							dropoff_lat: true,
							dropoff_long: true,
							dropoff_address: true,
							dropoff_time: true,
						},
					});
		const legByRoutePassenger = new Map<string, (typeof routeLegs)[number]>();
		for (const l of routeLegs) {
			legByRoutePassenger.set(`${l.route_id}:${l.passenger_id}`, l);
		}

		return {
			trips: sorted.map((pd) => {
				const plan = pd.route_daily_plan;
				const exec = plan.execution_route;
				const routeIdForLegs = exec?.id ?? null;
				return {
					phase_driver_id: pd.id,
					phase: pd.phase,
					route_daily_plan_id: pd.route_daily_plan_id,
					route_id: exec?.id ?? null,
					definition_route_id: plan.definition_route_id,
					scheduled_date: plan.scheduled_date,
					trip_start_time: pd.trip_start_time,
					trip_started_at: pd.trip_started_at,
					status: pd.status,
					plan_status: plan.status,
					started_at: plan.started_at,
					completed_at: plan.completed_at,
					office_address: exec?.office_address ?? null,
					office_lat: exec?.office_lat ?? null,
					office_long: exec?.office_long ?? null,
					route_batches_directions:
						exec?.batches?.map((b) => {
							// "phase k according": PICKUP phase => pickup_* fields, DROP phase => drop_* fields.
							if (pd.phase === "PICKUP") {
								return {
									batch_id: b.id,
									batch_order: b.batch_order,
									pickup_directions_polyline: b.pickup_directions_polyline,
									pickup_waypoint_order: b.pickup_waypoint_order,
									pickup_directions_legs: b.pickup_directions_legs,
									pickup_distance_meters: b.pickup_distance_meters,
									pickup_duration_seconds: b.pickup_duration_seconds,
								};
							}
							return {
								batch_id: b.id,
								batch_order: b.batch_order,
								drop_directions_polyline: b.drop_directions_polyline,
								drop_waypoint_order: b.drop_waypoint_order,
								drop_directions_legs: b.drop_directions_legs,
								drop_distance_meters: b.drop_distance_meters,
								drop_duration_seconds: b.drop_duration_seconds,
							};
						}) ?? [],
					phase_passengers: pd.route_daily_plan_phase_passengers.map((pp) => {
						const leg =
							routeIdForLegs != null
								? legByRoutePassenger.get(
										`${routeIdForLegs}:${pp.passenger_id}`,
									)
								: undefined;
						const stop =
							pd.phase === "PICKUP"
								? {
										lat: leg?.pickup_lat ?? null,
										long: leg?.pickup_long ?? null,
										pickup_address: leg?.pickup_address ?? null,
										pickup_time: leg?.pickup_time ?? null,
									}
								: {
										lat: leg?.dropoff_lat ?? null,
										long: leg?.dropoff_long ?? null,
										dropoff_address: leg?.dropoff_address ?? null,
										dropoff_time: leg?.dropoff_time ?? null,
									};
						return {
							id: pp.id,
							route_daily_plan_phase_driver_id:
								pp.route_daily_plan_phase_driver_id,
							passenger_id: pp.passenger_id,
							status: pp.status,
							driver_arrived_at: pp.driver_arrived_at,
							passenger_ack: pp.passenger_ack,
							picked_at: pp.picked_at,
							dropoff_arrived_at: pp.dropoff_arrived_at,
							dropped_at: pp.dropped_at,
							created_at: pp.created_at,
							updated_at: pp.updated_at,
							...stop,
							passenger: {
								id: pp.passenger.id,
								name: pp.passenger.name,
								phone_no: pp.passenger.phone_no,
							},
						};
					}),
				};
			}),
			driver: {
				id: driver.id,
				is_available: driver.is_available,
				current_lat: driverLive.current_lat,
				current_long: driverLive.current_long,
			},
			config,
		};
	},

	async startTrip(
		userId: number,
		phaseDriverId: number,
		selectedCarId?: number,
	) {
		const driver = await resolveDriver(userId);

		const phaseDriver = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				id: phaseDriverId,
				driver_id: driver.id,
				scheduled_date: phaseDriverScheduledDateWhere(),
				phase: { in: ["PICKUP", "DROP"] },
			},
			include: {
				route_daily_plan: {
					include: {
						execution_route: {
							include: {
								legs: {
									include: {
										passenger: {
											select: { id: true, name: true, phone_no: true },
										},
									},
									orderBy: { sequence: "asc" },
								},
								segments: { orderBy: { segment_order: "asc" } },
								batches: {
									orderBy: { batch_order: "asc" },
									include: {
										legs: {
											include: {
												passenger: {
													select: { id: true, name: true, phone_no: true },
												},
											},
										},
									},
								},
								driver: {
									include: {
										driver_assign_cars: {
											orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
											include: { car: true },
										},
									},
								},
							},
						},
					},
				},
			},
		});
		console.log("phaseDriver", phaseDriver);
		if (!phaseDriver) {
			throw ResponseHandler.notFound(
				"Trip not found, not assigned to you, or not scheduled for today",
			);
		}

		if (phaseDriver.status === "COMPLETED") {
			throw ResponseHandler.badRequest("This trip phase is already completed");
		}

		const plan = phaseDriver.route_daily_plan;
		const route = plan.execution_route;
		if (!route) {
			throw ResponseHandler.badRequest(
				"No execution route linked to this daily plan",
			);
		}

		const routeId = route.id;
		const isPickup = phaseDriver.phase === "PICKUP";
		const assignedCars = [...route.driver.driver_assign_cars].sort((a, b) => {
			if (a.is_default === b.is_default) return 0;
			return a.is_default ? -1 : 1;
		});
		const selectedAssignment =
			selectedCarId != null
				? assignedCars.find((x) => x.car_id === selectedCarId)
				: (assignedCars.find((x) => x.is_default) ?? assignedCars[0]);
		if (!selectedAssignment) {
			if (selectedCarId != null) {
				throw ResponseHandler.badRequest(
					"Selected car is not assigned to this driver",
				);
			}
			throw ResponseHandler.badRequest("No car assigned to this driver");
		}
		const car = selectedAssignment.car ?? null;
		const kmPerLiter = Number(car?.fuel_per_km ?? "");
		if (!Number.isFinite(kmPerLiter) || kmPerLiter <= 0) {
			throw ResponseHandler.badRequest(
				"Selected car has invalid km_per_liter (fuel_per_km).",
			);
		}
		const fuelPricePerLiterSnapshot = await getCurrentFuelPricePerLiter();

		if (phaseDriver.status === "ONGOING") {
			return this.getSession(userId, phaseDriver.id);
		}

		if (isPickup) {
			if (plan.status !== "PENDING") {
				throw ResponseHandler.badRequest(
					"Daily plan already started — use the active pickup phase or refresh session",
				);
			}
		} else {
			if (plan.status !== "PENDING" && plan.status !== "ONGOING") {
				throw ResponseHandler.badRequest(
					"Cannot start drop phase for this daily plan state",
				);
			}
		}

		const firstSeg = route.segments[0];
		if (!firstSeg)
			throw ResponseHandler.badRequest("Route has no segments configured");

		await db.$transaction(async (tx) => {
			const startedAt = new Date();

			if (isPickup) {
				await tx.routeDailyPlan.update({
					where: { id: plan.id },
					data: { status: "ONGOING", started_at: startedAt },
				});
				await tx.routeDailyPlanPhaseDriver.update({
					where: { id: phaseDriver.id },
					data: {
						trip_started_at: startedAt,
						status: "ONGOING",
						selected_car_id: selectedAssignment.car_id,
						trip_km: 0,
						km_per_liter_snapshot: kmPerLiter,
						fuel_price_per_liter_snapshot: fuelPricePerLiterSnapshot,
					},
				});
				await tx.routeSegment.update({
					where: { id: firstSeg.id },
					data: { status: "ONGOING" },
				});
			} else {
				if (plan.status === "PENDING") {
					await tx.routeDailyPlan.update({
						where: { id: plan.id },
						data: { status: "ONGOING", started_at: startedAt },
					});
					await tx.routeSegment.updateMany({
						where: {
							route_id: routeId,
							kind: "PICKUP_TO_OFFICE",
						},
						data: { status: "COMPLETED" },
					});
					await tx.routeDailyPlanPhaseDriver.updateMany({
						where: {
							route_daily_plan_id: plan.id,
							phase: "PICKUP",
						},
						data: { status: "COMPLETED" },
					});
				}

				const ongoingPickup = await tx.routeSegment.findFirst({
					where: {
						route_id: routeId,
						kind: "PICKUP_TO_OFFICE",
						status: "ONGOING",
					},
				});
				if (ongoingPickup) {
					await tx.routeSegment.update({
						where: { id: ongoingPickup.id },
						data: { status: "COMPLETED" },
					});
				}

				if (plan.status === "ONGOING") {
					await tx.routeDailyPlanPhaseDriver.updateMany({
						where: {
							route_daily_plan_id: plan.id,
							phase: "PICKUP",
						},
						data: { status: "COMPLETED" },
					});
				}

				await tx.routeDailyPlanPhaseDriver.update({
					where: { id: phaseDriver.id },
					data: {
						trip_started_at: startedAt,
						status: "ONGOING",
						selected_car_id: selectedAssignment.car_id,
						trip_km: 0,
						km_per_liter_snapshot: kmPerLiter,
						fuel_price_per_liter_snapshot: fuelPricePerLiterSnapshot,
					},
				});

				const dropSeg = await tx.routeSegment.findFirst({
					where: {
						route_id: routeId,
						kind: "DROP_TO_HOMES",
						status: "PENDING",
					},
					orderBy: { segment_order: "asc" },
				});
				if (dropSeg) {
					await tx.routeSegment.update({
						where: { id: dropSeg.id },
						data: { status: "ONGOING" },
					});
				}
			}
		});

		for (const leg of route.legs) {
			emitToPassenger(leg.passenger_id, "driver:started", {
				routeId: route.id,
				driverId: driver.id,
				driverName: driver.name,
				car: car
					? { name: car.name, car_no: car.car_no, car_color: car.car_color }
					: null,
			});
			void notificationService.sendToPassengerIds([leg.passenger_id], {
				title: "Trip Started",
				body: `${driver.name} has started your trip`,
				data: { routeId: String(route.id), type: "trip_started" },
			});
		}

		const firstLegGlobal = await getFirstRouteLegInPickupOrder(db, routeId);
		if (isPickup && firstLegGlobal?.pickup_time) {
			void db.routeDailyPlanPhaseDriver.update({
				where: { id: phaseDriver.id },
				data: { trip_start_time: firstLegGlobal.pickup_time.trim() },
			});
		} else if (!isPickup) {
			const plannedDropTime =
				firstLegGlobal?.office_pick_up_time?.trim() ?? null;
			void db.routeDailyPlanPhaseDriver.update({
				where: { id: phaseDriver.id },
				data: { trip_start_time: plannedDropTime },
			});
		}

		return this.getSession(userId, phaseDriver.id);
	},

	async updateLocation(userId: number, lat: number, long: number) {
		const driver = await resolveDriver(userId);
		const updatedAt = new Date();
		setDriverLiveLocation(driver.id, lat, long, updatedAt);

		const route = await db.route.findFirst({
			where: {
				driver_id: driver.id,
				route_daily_plan_id: { not: null },
				daily_plan: {
					status: "ONGOING",
					...dailyPlanForActiveDayWhere(),
				},
			},
			include: { legs: { select: { passenger_id: true } } },
		});

		if (route) {
			const passengerIds = route.legs.map((l) => l.passenger_id);
			const payload = {
				driverId: driver.id,
				lat,
				long,
				updated_at: updatedAt,
				driver_name: driver.name ?? null,
				driver_phone_no: driver.phone_no ?? null,
				driver_email: driver.user?.email ?? null,
				user_id: driver.user_id ?? null,
			};
			emitToPassengers(passengerIds, "driver:location", payload);
			emitToDriver(driver.id, "driver:location", payload);
			emitToAdmins("driver:location", payload);
		} else {
			const payload = {
				driverId: driver.id,
				lat,
				long,
				updated_at: updatedAt,
				driver_name: driver.name ?? null,
				driver_phone_no: driver.phone_no ?? null,
				driver_email: driver.user?.email ?? null,
				user_id: driver.user_id ?? null,
			};
			emitToDriver(driver.id, "driver:location", payload);
			emitToAdmins("driver:location", payload);
		}

		return { lat, long, updated_at: updatedAt };
	},

	/**
	 * Driver arrived at a stop — updates `RouteDailyPlanPhasePassenger` by **row id** (`phase_passengers[].id` from GET /session).
	 * Use `RouteDailyPlanPhasePassenger.id`, not `RouteDailyPlanPhaseDriver.id`.
	 */
	async arriveAtPassenger(userId: number, phasePassengerId: number) {
		const driver = await resolveDriver(userId);

		const pp = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				id: phasePassengerId,
				route_daily_plan_phase_driver: { driver_id: driver.id },
			},
			include: {
				passenger: { select: { id: true, name: true, phone_no: true } },
				route_daily_plan_phase_driver: {
					include: {
						route_daily_plan: { select: { id: true, status: true } },
					},
				},
			},
		});
		if (!pp) {
			throw ResponseHandler.notFound(
				"Phase passenger row not found or not assigned to this driver",
			);
		}

		const phaseDriver = pp.route_daily_plan_phase_driver;
		const plan = phaseDriver.route_daily_plan;

		if (phaseDriver.status !== "ONGOING") {
			throw ResponseHandler.badRequest(
				"Start this phase trip first — phase is not ONGOING",
			);
		}
		if (plan.status !== "ONGOING") {
			throw ResponseHandler.badRequest(
				"Daily plan must be ONGOING before marking arrival",
			);
		}

		const config = await db.driverConfiguration.findFirst();
		const now = new Date();
		const isPickup = phaseDriver.phase === "PICKUP";
		const passengerId = pp.passenger_id;

		await db.routeDailyPlanPhasePassenger.update({
			where: { id: pp.id },
			data: isPickup
				? { status: "ARRIVED", driver_arrived_at: now }
				: { status: "ARRIVED", dropoff_arrived_at: now },
		});

		const execRoute = await db.route.findFirst({
			where: { route_daily_plan_id: phaseDriver.route_daily_plan_id },
			select: { id: true },
		});
		const leg = execRoute
			? await db.routeLeg.findFirst({
					where: {
						route_id: execRoute.id,
						passenger_id: passengerId,
					},
					select: { id: true },
				})
			: null;
		const routeId = execRoute?.id ?? null;
		const legId = leg?.id ?? null;

		const executionKind = isPickup ? "PICKUP_TO_OFFICE" : "DROP_TO_HOMES";

		emitToPassenger(passengerId, "driver:arrived", {
			driverId: driver.id,
			driverName: driver.name,
			routeId,
			legId,
			passenger: { id: pp.passenger.id, name: pp.passenger.name },
			phase: executionKind,
			arrived_at: now,
		});
		void notificationService.sendToPassengerIds([passengerId], {
			title: "Driver Arrived",
			body: `${driver.name} has arrived at your location`,
			data: {
				routeId: routeId != null ? String(routeId) : "",
				legId: legId != null ? String(legId) : "",
				type: "driver_arrived",
			},
		});

		return {
			phase_passenger_id: pp.id,
			phase_driver_id: phaseDriver.id,
			phase: phaseDriver.phase,
			passenger: { id: pp.passenger.id, name: pp.passenger.name },
			route_id: routeId,
			leg_id: legId,
			execution_kind: executionKind,
			driver_arrived_at: isPickup ? now.toISOString() : null,
			dropoff_arrived_at: isPickup ? null : now.toISOString(),
			config: {
				still_waiting_button_appear_in: config?.still_waiting_button_appear_in,
				passenger_waiting_time: config?.passenger_waiting_time,
				skip_button_appear_in: config?.skip_button_appear_in,
			},
		};
	},

	async legAction(userId: number, phasePassengerId: number, action: LegAction) {
		const driver = await resolveDriver(userId);

		const ppRow = await db.routeDailyPlanPhasePassenger.findFirst({
			where: {
				id: phasePassengerId,
				route_daily_plan_phase_driver: { driver_id: driver.id },
			},
			include: {
				passenger: { select: { id: true, name: true, phone_no: true } },
				route_daily_plan_phase_driver: {
					include: {
						route_daily_plan: { select: { id: true, status: true } },
					},
				},
			},
		});
		if (!ppRow) {
			throw ResponseHandler.notFound(
				"Phase passenger row not found or not assigned to this driver",
			);
		}

		const phaseDriver = ppRow.route_daily_plan_phase_driver;
		const plan = phaseDriver.route_daily_plan;
		if (phaseDriver.status !== "ONGOING") {
			throw ResponseHandler.badRequest(
				"Start this phase trip first — phase is not ONGOING",
			);
		}
		if (plan.status !== "ONGOING") {
			throw ResponseHandler.badRequest("Daily plan must be ONGOING");
		}

		const routePlanId = phaseDriver.route_daily_plan_id;
		const execRoute = await db.route.findFirst({
			where: { route_daily_plan_id: routePlanId },
			select: { id: true },
		});
		if (!execRoute) {
			throw ResponseHandler.badRequest(
				"No execution route for this daily plan",
			);
		}
		const routeId = execRoute.id;

		const leg = await db.routeLeg.findFirst({
			where: {
				route_id: routeId,
				passenger_id: ppRow.passenger_id,
			},
			include: {
				passenger: { select: { id: true, name: true, phone_no: true } },
			},
		});
		if (!leg)
			throw ResponseHandler.notFound("Route leg not found for passenger");

		const seg = await db.routeSegment.findFirst({
			where: {
				route_id: routeId,
				status: "ONGOING",
				batch_id: leg.batch_id,
			},
		});
		if (!seg)
			throw ResponseHandler.badRequest(
				"No active segment for this leg / batch",
			);

		const isPickup = seg.kind === "PICKUP_TO_OFFICE";
		if (isPickup && phaseDriver.phase !== "PICKUP") {
			throw ResponseHandler.badRequest(
				"This phase passenger is not for the active pickup segment — use the PICKUP phase_passenger id",
			);
		}
		if (!isPickup && phaseDriver.phase !== "DROP") {
			throw ResponseHandler.badRequest(
				"This phase passenger is not for the active drop segment — use the DROP phase_passenger id",
			);
		}

		const legId = leg.id;
		const passengerId = ppRow.passenger_id;

		if (isPickup) {
			if (action === "PICKED") {
				await updatePhasePassengerRow(db, routePlanId, "PICKUP", passengerId, {
					status: "PICKED",
					picked_at: new Date(),
				});
			} else if (action === "STILL_WAITING") {
				await updatePhasePassengerRow(db, routePlanId, "PICKUP", passengerId, {
					status: "STILL_WAITING",
				});
			} else if (action === "MOVE_TO_NEXT") {
				await updatePhasePassengerRow(db, routePlanId, "PICKUP", passengerId, {
					status: "MOVE_TO_NEXT",
				});
			}

			emitToPassenger(passengerId, "driver:action", {
				action,
				legId,
				routeId,
				phase: "PICKUP",
			});
			if (action === "MOVE_TO_NEXT") {
				void notificationService.sendToPassengerIds([passengerId], {
					title: "Trip Update",
					body: "Driver moved to next passenger",
					data: {
						routeId: String(routeId),
						legId: String(legId),
						type: "driver_moved_next",
					},
				});
			}

			const nextLeg = await findNextPickupLegInBatch(
				db,
				routeId,
				leg.batch_id,
				legId,
				routePlanId,
			);

			if (!nextLeg) {
				const pendingCount = await countPickupPendingOrArrivedInBatch(
					db,
					routeId,
					leg.batch_id,
					routePlanId,
				);
				if (pendingCount === 0) {
					// Pickup batch done. To avoid empty queue, auto-advance to next segment.
					// This keeps `route_segments.status` aligned with what the driver should see next.
					await db.routeSegment.update({
						where: { id: seg.id },
						data: { status: "COMPLETED" },
					});

					const nextSeg = await db.routeSegment.findFirst({
						where: { route_id: routeId, status: "PENDING" },
						orderBy: { segment_order: "asc" },
					});

					if (nextSeg) {
						await db.routeSegment.update({
							where: { id: nextSeg.id },
							data: { status: "ONGOING" },
						});

						// When we transition into DROP segment, freeze drop phase start.
						if (nextSeg.kind === "DROP_TO_HOMES") {
							const execForPlan = await db.route.findUnique({
								where: { id: routeId },
								select: { route_daily_plan_id: true },
							});
							if (execForPlan?.route_daily_plan_id) {
								const firstPickupLeg = await getFirstRouteLegInPickupOrder(
									db,
									routeId,
								);
								const plannedDropTime =
									firstPickupLeg?.office_pick_up_time?.trim() ?? null;
								await db.routeDailyPlanPhaseDriver.updateMany({
									where: {
										route_daily_plan_id: execForPlan.route_daily_plan_id,
										phase: "DROP",
									},
									data: {
										trip_start_time: plannedDropTime,
										trip_started_at: new Date(),
										status: "ONGOING",
									},
								});
							}
						}

						const routeOffice = await db.route.findUnique({
							where: { id: routeId },
							select: {
								office_address: true,
								office_lat: true,
								office_long: true,
							},
						});
						if (routeOffice) {
							void notificationService.sendToDriverId(driver.id, {
								title: "Next Location",
								body: `Go to office: ${routeOffice.office_address}`,
								data: {
									routeId: String(routeId),
									type: "driver_next_office",
								},
							});
						}
						return {
							action,
							next_passenger: null,
							next_office: routeOffice
								? {
										address: routeOffice.office_address,
										lat: routeOffice.office_lat,
										long: routeOffice.office_long,
									}
								: null,
							navigate_to_office: true,
							message: "Pickup batch complete. Navigate to office.",
							execution_kind: nextSeg.kind,
						};
					}

					// No next segment -> let client finalize.
					return {
						action,
						next_passenger: null,
						navigate_to_office: true,
						message: "Pickup batch complete. No next segment found.",
						execution_kind: "PICKUP_TO_OFFICE",
					};
				}
				return {
					action,
					next_passenger: null,
					navigate_to_office: false,
					message: "Finish remaining pickup interactions in this batch.",
					execution_kind: "PICKUP_TO_OFFICE",
				};
			}

			emitToDriver(
				driver.id,
				"next:passenger",
				nextLeg
					? {
							leg_id: nextLeg.id,
							passenger: {
								id: nextLeg.passenger.id,
								name: nextLeg.passenger.name,
							},
							pickup_address: nextLeg.pickup_address,
							pickup_lat: nextLeg.pickup_lat,
							pickup_long: nextLeg.pickup_long,
						}
					: null,
			);
			void notificationService.sendToDriverId(driver.id, {
				title: "Next Location",
				body: `Next pickup: ${nextLeg.pickup_address}`,
				data: {
					routeId: String(routeId),
					legId: String(nextLeg.id),
					type: "driver_next_pickup",
				},
			});

			return {
				action,
				next_passenger: nextLeg
					? {
							leg_id: nextLeg.id,
							passenger: {
								id: nextLeg.passenger.id,
								name: nextLeg.passenger.name,
							},
							pickup_address: nextLeg.pickup_address,
							pickup_lat: nextLeg.pickup_lat,
							pickup_long: nextLeg.pickup_long,
						}
					: null,
				navigate_to_office: !nextLeg,
				execution_kind: "PICKUP_TO_OFFICE",
			};
		}

		// DROP segment
		if (action === "PICKED") {
			await updatePhasePassengerRow(db, routePlanId, "DROP", passengerId, {
				status: "DROPPED",
				dropped_at: new Date(),
			});
		} else if (action === "STILL_WAITING") {
			await updatePhasePassengerRow(db, routePlanId, "DROP", passengerId, {
				status: "STILL_WAITING",
			});
		} else if (action === "MOVE_TO_NEXT") {
			await updatePhasePassengerRow(db, routePlanId, "DROP", passengerId, {
				status: "MOVE_TO_NEXT",
			});
		}

		emitToPassenger(passengerId, "driver:action", {
			action,
			legId,
			routeId,
			phase: "DROP",
		});
		if (action === "PICKED") {
			void notificationService.sendToPassengerIds([passengerId], {
				title: "Drop Update",
				body: "You have been marked as dropped",
				data: {
					routeId: String(routeId),
					legId: String(legId),
					type: "passenger_dropped",
				},
			});
		}

		const nextDrop = await findNextDropLegInBatch(
			db,
			routeId,
			leg.batch_id,
			legId,
			routePlanId,
		);

		if (!nextDrop) {
			const pendingDrop = await countDropPendingOrArrivedInBatch(
				db,
				routeId,
				leg.batch_id,
				routePlanId,
			);
			if (pendingDrop === 0) {
				await db.routeSegment.update({
					where: { id: seg.id },
					data: { status: "COMPLETED" },
				});

				const nextSeg = await db.routeSegment.findFirst({
					where: { route_id: routeId, status: "PENDING" },
					orderBy: { segment_order: "asc" },
				});

				if (nextSeg) {
					await db.routeSegment.update({
						where: { id: nextSeg.id },
						data: { status: "ONGOING" },
					});
					return {
						action,
						next_passenger: null,
						navigate_to_office: nextSeg.kind === "PICKUP_TO_OFFICE",
						message:
							nextSeg.kind === "PICKUP_TO_OFFICE"
								? "Next batch: pickups. Follow updated route."
								: "Next: drop segment. Follow updated route.",
						execution_kind: nextSeg.kind,
						route_continues: true,
					};
				}

				const execForPlan = await db.route.findUnique({
					where: { id: routeId },
					select: { route_daily_plan_id: true },
				});
				if (execForPlan?.route_daily_plan_id) {
					await db.routeDailyPlan.update({
						where: { id: execForPlan.route_daily_plan_id },
						data: { status: "COMPLETED", completed_at: new Date() },
					});
					await db.routeDailyPlanPhaseDriver.updateMany({
						where: {
							route_daily_plan_id: execForPlan.route_daily_plan_id,
						},
						data: { status: "COMPLETED" },
					});
				}
				await db.driver.update({
					where: { id: driver.id },
					data: { is_available: false, available_at: null },
				});

				const route = await db.route.findUnique({
					where: { id: routeId },
					include: { legs: { select: { passenger_id: true } } },
				});
				if (route) {
					emitToPassengers(
						route.legs.map((l) => l.passenger_id),
						"ride:completed",
						{
							routeId,
							driverId: driver.id,
							completed_at: new Date(),
						},
					);
					void notificationService.sendToPassengerIds(
						route.legs.map((l) => l.passenger_id),
						{
							title: "Ride Completed",
							body: "Your ride has been completed",
							data: { routeId: String(routeId), type: "ride_completed" },
						},
					);
				}

				return {
					action,
					next_passenger: null,
					navigate_to_office: false,
					route_completed: true,
					message: "All segments finished.",
					execution_kind: "DROP_TO_HOMES",
				};
			}
		}

		emitToDriver(
			driver.id,
			"next:passenger",
			nextDrop
				? {
						leg_id: nextDrop.id,
						passenger: {
							id: nextDrop.passenger.id,
							name: nextDrop.passenger.name,
						},
						dropoff_address: nextDrop.dropoff_address,
						dropoff_lat: nextDrop.dropoff_lat,
						dropoff_long: nextDrop.dropoff_long,
					}
				: null,
		);
		if (nextDrop) {
			void notificationService.sendToDriverId(driver.id, {
				title: "Next Location",
				body: `Next drop: ${nextDrop.dropoff_address}`,
				data: {
					routeId: String(routeId),
					legId: String(nextDrop.id),
					type: "driver_next_drop",
				},
			});
		}

		return {
			action,
			next_passenger: nextDrop
				? {
						leg_id: nextDrop.id,
						passenger: {
							id: nextDrop.passenger.id,
							name: nextDrop.passenger.name,
						},
						dropoff_address: nextDrop.dropoff_address,
						dropoff_lat: nextDrop.dropoff_lat,
						dropoff_long: nextDrop.dropoff_long,
					}
				: null,
			navigate_to_office: false,
			execution_kind: "DROP_TO_HOMES",
		};
	},

	/**
	 * Call when driver reaches office after finishing a pickup batch (navigate_to_office).
	 * Advances to the next segment (next pickup batch or first drop batch).
	 */
	async officeCheckpoint(userId: number, routeId: number) {
		const driver = await resolveDriver(userId);

		const seg = await db.routeSegment.findFirst({
			where: {
				route_id: routeId,
				status: "ONGOING",
				kind: "PICKUP_TO_OFFICE",
			},
			include: { batch: true },
		});
		// If we already auto-advanced segment in `legAction`, there may be no active pickup segment now.
		// Make this endpoint idempotent to prevent client errors.
		if (!seg) {
			const activeAny = await db.routeSegment.findFirst({
				where: { route_id: routeId, status: "ONGOING" },
			});
			if (!activeAny) {
				throw ResponseHandler.badRequest(
					"Office checkpoint not available (no active segment found)",
				);
			}
			return {
				next_segment_kind: activeAny.kind,
				batch_id: activeAny.batch_id,
				message:
					"Office checkpoint ignored: next segment already active (auto-advanced).",
			};
		}

		const routePlanForCheckpoint = await getRouteDailyPlanId(db, routeId);
		if (!routePlanForCheckpoint) {
			throw ResponseHandler.badRequest("Route has no daily plan");
		}
		const pending = await countPickupPendingOrArrivedInBatch(
			db,
			routeId,
			seg.batch_id,
			routePlanForCheckpoint,
		);
		if (pending > 0) {
			throw ResponseHandler.badRequest(
				"Complete or skip all pickups in this batch before office checkpoint",
			);
		}

		const result = await runPickupOfficeAdvanceCore(
			routeId,
			routePlanForCheckpoint,
			seg,
		);

		return {
			next_segment_kind: result.kind,
			batch_id: result.batch_id,
			message:
				result.kind === "PICKUP_TO_OFFICE"
					? "Continue with next pickup batch."
					: "Start drop-offs. Route updated.",
		};
	},

	/**
	 * Driver reports an active route issue (e.g. protest/road blockage) with image + optional note.
	 */
	async reportRouteIssue(
		userId: number,
		routeId: number,
		imageUrl: string,
		note?: string | null,
	) {
		const driver = await resolveDriver(userId);
		console.log("driver", driver);

		const route = await db.route.findFirst({
			where: {
				id: routeId,
				driver_id: driver.id,
				route_daily_plan_id: { not: null },
				daily_plan: { status: "ONGOING" },
			},
			select: {
				id: true,
				route_daily_plan_id: true,
			},
		});
		if (!route) {
			throw ResponseHandler.notFound(
				"Active ONGOING route not found for this driver",
			);
		}

		const activePhase = await db.routeDailyPlanPhaseDriver.findFirst({
			where: {
				route_daily_plan_id: route.route_daily_plan_id ?? undefined,
				driver_id: driver.id,
				status: "ONGOING",
			},
			select: { id: true, phase: true },
		});
		if (!activePhase) {
			throw ResponseHandler.badRequest(
				"You can report issues only while actively driving this route",
			);
		}

		const report = await db.routeIssueReport.create({
			data: {
				route_id: route.id,
				driver_id: driver.id,
				image_url: imageUrl,
				note: note?.trim() ? note.trim() : null,
			},
			select: {
				id: true,
				route_id: true,
				driver_id: true,
				image_url: true,
				note: true,
				created_at: true,
			},
		});

		emitToAdmins("route:issue_reported", {
			reportId: report.id,
			routeId: report.route_id,
			driverId: report.driver_id,
			image_url: report.image_url,
			note: report.note,
			created_at: report.created_at,
		});

		return {
			...report,
			phase_driver_id: activePhase.id,
			phase: activePhase.phase,
		};
	},

	async completeTrip(userId: number, phaseDriverId: number) {
		const driver = await resolveDriver(userId);

		const pd = await db.routeDailyPlanPhaseDriver.findFirst({
			where: { id: phaseDriverId, driver_id: driver.id },
			include: { route_daily_plan: true },
		});
		if (!pd) {
			throw ResponseHandler.notFound(
				"Phase driver not found or not assigned to this driver",
			);
		}

		const plan = pd.route_daily_plan;
		if (!plan) {
			throw ResponseHandler.badRequest("Daily plan missing for this phase");
		}

		const route = await db.route.findFirst({
			where: { id: plan.definition_route_id },
		});
		const executionRoute = await db.route.findFirst({
			where: { route_daily_plan_id: plan.id },
			select: {
				batches: {
					select: { pickup_distance_meters: true, drop_distance_meters: true },
				},
			},
		});
		const tripMeters = (executionRoute?.batches ?? []).reduce((sum, b) => {
			const meters =
				pd.phase === "PICKUP"
					? (b.pickup_distance_meters ?? 0)
					: (b.drop_distance_meters ?? 0);
			return sum + meters;
		}, 0);
		const tripKm = Math.round((tripMeters / 1000) * 100) / 100;
		const kmPerLiter = pd.km_per_liter_snapshot ?? 0;
		const fuelPricePerLiter = pd.fuel_price_per_liter_snapshot ?? 0;
		const fuelCost =
			kmPerLiter > 0 && fuelPricePerLiter > 0
				? Math.round((tripKm / kmPerLiter) * fuelPricePerLiter * 100) / 100
				: 0;

		//add trip price to the route daily plan phase driver

		await db.routeDailyPlanPhaseDriver.update({
			where: { id: pd.id },
			data: {
				status: "COMPLETED",
				trip_price: route?.route_price ? route.route_price / 2 : 0,
				trip_km: tripKm,
				fuel_cost: fuelCost,
			},
		});
		//if drop phase is completed, update the route daily plan status to completed
		if (pd.phase === "DROP") {
			await db.routeDailyPlan.update({
				where: { id: plan.id },
				data: { status: "COMPLETED", completed_at: new Date() },
			});
		}
		//driver is now unavailable
		await db.driver.update({
			where: { id: driver.id },
			data: { is_available: false, available_at: new Date() },
		});
		const routePlanId = pd.route_daily_plan_id;
		const routeDailyPlan = await db.routeDailyPlan.findFirst({
			where: { id: routePlanId },
		});

		return {
			route_daily_plan_id: routePlanId,
			phase_driver_id: pd.id,
			phase_completed: pd.phase,
			plan_status: routeDailyPlan?.status,
			driver: {
				id: driver.id,
				name: driver.name,
			},
			message: "Trip completed",
		};
	},
};

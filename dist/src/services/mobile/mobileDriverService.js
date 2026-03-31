"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileDriverService = void 0;
const database_1 = require("../../config/database");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const socketService_1 = require("../../config/socketService");
const routeService_1 = require("../routeService");
const liveLocationStore_1 = require("../../utils/liveLocationStore");
const db = database_1.DatabaseService.getInstance().getPrisma();
const routeService = new routeService_1.RouteService();
// ---------- helpers ----------
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function resolveDriver(userId) {
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
        },
    });
    if (!driver)
        throw ResponseHandler_1.ResponseHandler.notFound("Driver profile not found");
    return driver;
}
function distanceKmForLeg(driver, leg, isPickup) {
    if (driver.current_lat === null || driver.current_long === null)
        return null;
    const lat = isPickup ? leg.pickup_lat : leg.dropoff_lat;
    const lng = isPickup ? leg.pickup_long : leg.dropoff_long;
    return haversineKm(driver.current_lat, driver.current_long, lat, lng).toFixed(2);
}
function getDriverLocationSnapshot(driverId) {
    const loc = (0, liveLocationStore_1.getDriverLiveLocation)(driverId);
    return {
        current_lat: loc?.lat ?? null,
        current_long: loc?.long ?? null,
        location_updated_at: loc?.updated_at ?? null,
    };
}
/** Polyline + meta for display: ONGOING segment, else first segment preview. */
async function getDisplayDirectionsForRoute(routeId) {
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
    if (!seg)
        return null;
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
function buildQueueItem(leg, idx, isPickup, driver) {
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
        execution_phase: isPickup ? "PICKUP" : "DROP",
    };
    if (isPickup) {
        return {
            ...base,
            pickup_address: leg.pickup_address,
            pickup_lat: leg.pickup_lat,
            pickup_long: leg.pickup_long,
            pickup_time: leg.pickup_time,
            pickup_status: leg.pickup_status,
            passenger_ack: leg.passenger_ack,
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
        dropoff_status: leg.dropoff_status,
        stop_address: leg.dropoff_address,
        stop_lat: leg.dropoff_lat,
        stop_long: leg.dropoff_long,
        distance_km: distanceKmForLeg(driver, leg, false),
    };
}
// ---------- service ----------
exports.MobileDriverService = {
    async goAvailable(userId) {
        const driver = await resolveDriver(userId);
        const driverLive = getDriverLocationSnapshot(driver.id);
        const config = await db.driverConfiguration.findFirst();
        if (!config)
            throw ResponseHandler_1.ResponseHandler.notFound("Driver configuration not found");
        const updatedDriver = await db.driver.update({
            where: { id: driver.id },
            data: {
                is_available: true,
                available_at: new Date(),
            },
        });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const routes = await db.route.findMany({
            where: {
                driver_id: driver.id,
                status: "PENDING",
                created_at: { gte: today, lt: tomorrow },
            },
            include: {
                legs: { include: { passenger: true } },
                batches: {
                    orderBy: { batch_order: "asc" },
                    include: { legs: { include: { passenger: true } } },
                },
                segments: { orderBy: { segment_order: "asc" } },
                driver: {
                    include: {
                        driver_assign_cars: { include: { car: true }, take: 1 },
                    },
                },
            },
        });
        for (const route of routes) {
            const passengerIds = route.legs.map((l) => l.passenger_id);
            (0, socketService_1.emitToPassengers)(passengerIds, "driver:available", {
                driverId: driver.id,
                driverName: driver.name,
                routeId: route.id,
                availableAt: updatedDriver.available_at,
                config: {
                    remaining_start_time: config.remaining_start_time,
                    availability_time: config.availability_time,
                },
            });
        }
        const mapped = await Promise.all(routes
            .slice()
            .sort((a, b) => b.id - a.id)
            .map(async (route) => {
            const dir = await getDisplayDirectionsForRoute(route.id);
            const firstBatch = route.batches[0];
            const legs = firstBatch?.legs ?? route.legs;
            const sorted = [...legs].sort((a, b) => a.sequence - b.sequence);
            const queue = sorted
                .filter((l) => ["PENDING", "ARRIVED"].includes(l.pickup_status))
                .map((leg, idx) => buildQueueItem(leg, idx, true, driverLive));
            return {
                id: route.id,
                status: route.status,
                office_address: route.office_address,
                office_lat: route.office_lat,
                office_long: route.office_long,
                started_at: route.started_at,
                directions_polyline: dir?.directions_polyline ?? route.directions_polyline,
                directions_waypoint_order: dir?.directions_waypoint_order ?? route.directions_waypoint_order,
                directions_legs: dir?.directions_legs ?? route.directions_legs,
                directions_distance_meters: dir?.directions_distance_meters ??
                    route.directions_distance_meters,
                directions_duration_seconds: dir?.directions_duration_seconds ??
                    route.directions_duration_seconds,
                directions_updated_at: dir?.directions_updated_at ?? route.directions_updated_at,
                execution_kind: dir?.execution_kind ?? "PICKUP_TO_OFFICE",
                batches: route.batches.map((b) => ({
                    id: b.id,
                    batch_order: b.batch_order,
                })),
                segments: route.segments.map((s) => ({
                    id: s.id,
                    segment_order: s.segment_order,
                    kind: s.kind,
                    status: s.status,
                    batch_id: s.batch_id,
                })),
                passengers_queue: queue,
            };
        }));
        return {
            routes: mapped,
            driver: {
                id: driver.id,
                is_available: true,
                current_lat: driverLive.current_lat,
                current_long: driverLive.current_long,
            },
            config: {
                availability_time: config.availability_time,
                remaining_start_time: config.remaining_start_time,
            },
        };
    },
    async getSession(userId) {
        const driver = await resolveDriver(userId);
        const driverLive = getDriverLocationSnapshot(driver.id);
        const config = await db.driverConfiguration.findFirst();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const route = await db.route.findFirst({
            where: {
                driver_id: driver.id,
                status: { in: ["PENDING", "ONGOING"] },
                created_at: { gte: today, lt: tomorrow },
            },
            include: {
                legs: { include: { passenger: true } },
                batches: {
                    orderBy: { batch_order: "asc" },
                    include: { legs: { include: { passenger: true } } },
                },
                segments: { orderBy: { segment_order: "asc" } },
            },
            orderBy: { id: "desc" },
        });
        if (!route) {
            return {
                route: null,
                driver: {
                    id: driver.id,
                    is_available: driver.is_available,
                    current_lat: driverLive.current_lat,
                    current_long: driverLive.current_long,
                },
                config,
            };
        }
        const activeSeg = (await db.routeSegment.findFirst({
            where: { route_id: route.id, status: "ONGOING" },
            include: {
                batch: { include: { legs: { include: { passenger: true } } } },
            },
        })) ??
            (await db.routeSegment.findFirst({
                where: { route_id: route.id, segment_order: 0 },
                include: {
                    batch: { include: { legs: { include: { passenger: true } } } },
                },
            }));
        if (!activeSeg) {
            return {
                route: null,
                driver: {
                    id: driver.id,
                    is_available: driver.is_available,
                    current_lat: driverLive.current_lat,
                    current_long: driverLive.current_long,
                },
                config,
            };
        }
        const isPickup = activeSeg.kind === "PICKUP_TO_OFFICE";
        const batchLegs = activeSeg.batch.legs;
        const filtered = isPickup
            ? batchLegs.filter((l) => ["PENDING", "ARRIVED"].includes(l.pickup_status))
            : batchLegs.filter((l) => ["PENDING", "ARRIVED"].includes(l.dropoff_status));
        const sorted = isPickup
            ? [...filtered].sort((a, b) => a.sequence - b.sequence)
            : [...filtered].sort((a, b) => a.drop_sequence - b.drop_sequence);
        const dir = await getDisplayDirectionsForRoute(route.id);
        return {
            route: {
                id: route.id,
                status: route.status,
                office_address: route.office_address,
                office_lat: route.office_lat,
                office_long: route.office_long,
                started_at: route.started_at,
                directions_polyline: dir?.directions_polyline ?? route.directions_polyline,
                directions_waypoint_order: dir?.directions_waypoint_order ?? route.directions_waypoint_order,
                directions_legs: dir?.directions_legs ?? route.directions_legs,
                directions_distance_meters: dir?.directions_distance_meters ?? route.directions_distance_meters,
                directions_duration_seconds: dir?.directions_duration_seconds ?? route.directions_duration_seconds,
                directions_updated_at: dir?.directions_updated_at ?? route.directions_updated_at,
                execution_kind: activeSeg.kind,
                active_segment_id: activeSeg.id,
                batches: route.batches.map((b) => ({
                    id: b.id,
                    batch_order: b.batch_order,
                })),
                segments: route.segments.map((s) => ({
                    id: s.id,
                    segment_order: s.segment_order,
                    kind: s.kind,
                    status: s.status,
                    batch_id: s.batch_id,
                })),
                passengers_queue: sorted.map((leg, idx) => buildQueueItem(leg, idx, isPickup, driverLive)),
            },
            driver: {
                id: driver.id,
                is_available: driver.is_available,
                current_lat: driverLive.current_lat,
                current_long: driverLive.current_long,
            },
            config,
        };
    },
    async startTrip(userId, routeId) {
        const driver = await resolveDriver(userId);
        const driverLive = getDriverLocationSnapshot(driver.id);
        const route = await db.route.findFirst({
            where: { id: routeId, driver_id: driver.id, status: "PENDING" },
            include: {
                legs: { include: { passenger: true }, orderBy: { sequence: "asc" } },
                segments: { orderBy: { segment_order: "asc" } },
                driver: {
                    include: {
                        driver_assign_cars: { include: { car: true }, take: 1 },
                    },
                },
            },
        });
        if (!route)
            throw ResponseHandler_1.ResponseHandler.notFound("Route not found or already started");
        const firstSeg = route.segments[0];
        if (!firstSeg)
            throw ResponseHandler_1.ResponseHandler.badRequest("Route has no segments configured");
        await db.$transaction(async (tx) => {
            await tx.route.update({
                where: { id: routeId },
                data: { status: "ONGOING", started_at: new Date() },
            });
            await tx.routeSegment.update({
                where: { id: firstSeg.id },
                data: { status: "ONGOING" },
            });
        });
        await routeService.syncRouteDisplayDirections(routeId);
        const startedRoute = await db.route.findUnique({
            where: { id: routeId },
            include: {
                legs: { include: { passenger: true }, orderBy: { sequence: "asc" } },
                segments: { orderBy: { segment_order: "asc" } },
                batches: {
                    orderBy: { batch_order: "asc" },
                    include: { legs: { include: { passenger: true } } },
                },
            },
        });
        if (!startedRoute) {
            throw ResponseHandler_1.ResponseHandler.notFound("Route not found after start");
        }
        const config = await db.driverConfiguration.findFirst();
        const car = route.driver.driver_assign_cars[0]?.car ?? null;
        const activeBatch = startedRoute.batches.find((b) => b.id === firstSeg.batch_id);
        const sortedLegs = activeBatch?.legs.length
            ? [...activeBatch.legs].sort((a, b) => a.sequence - b.sequence)
            : startedRoute.legs;
        for (const leg of route.legs) {
            (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:started", {
                routeId: route.id,
                driverId: driver.id,
                driverName: driver.name,
                car: car
                    ? { name: car.name, car_no: car.car_no, car_color: car.car_color }
                    : null,
            });
        }
        const firstLeg = sortedLegs[0];
        const queue = sortedLegs
            .filter((l) => ["PENDING", "ARRIVED"].includes(l.pickup_status))
            .map((leg, idx) => buildQueueItem(leg, idx, true, driverLive));
        return {
            route: {
                id: startedRoute.id,
                status: startedRoute.status,
                office_address: startedRoute.office_address,
                office_lat: startedRoute.office_lat,
                office_long: startedRoute.office_long,
                started_at: startedRoute.started_at,
                directions_polyline: startedRoute.directions_polyline,
                directions_waypoint_order: startedRoute.directions_waypoint_order,
                directions_legs: startedRoute.directions_legs,
                directions_distance_meters: startedRoute.directions_distance_meters,
                directions_duration_seconds: startedRoute.directions_duration_seconds,
                directions_updated_at: startedRoute.directions_updated_at,
                execution_kind: "PICKUP_TO_OFFICE",
                passengers_queue: queue,
            },
            first_passenger: firstLeg
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
                : null,
            config,
        };
    },
    async updateLocation(userId, lat, long) {
        const driver = await resolveDriver(userId);
        const updatedAt = new Date();
        (0, liveLocationStore_1.setDriverLiveLocation)(driver.id, lat, long, updatedAt);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const route = await db.route.findFirst({
            where: {
                driver_id: driver.id,
                status: "ONGOING",
                created_at: { gte: today, lt: tomorrow },
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
            };
            (0, socketService_1.emitToPassengers)(passengerIds, "driver:location", payload);
            (0, socketService_1.emitToDriver)(driver.id, "driver:location", payload);
            (0, socketService_1.emitToAdmins)("driver:location", payload);
        }
        else {
            const payload = {
                driverId: driver.id,
                lat,
                long,
                updated_at: updatedAt,
            };
            (0, socketService_1.emitToDriver)(driver.id, "driver:location", payload);
            (0, socketService_1.emitToAdmins)("driver:location", payload);
        }
        return { lat, long, updated_at: updatedAt };
    },
    async arriveAtPassenger(userId, routeId, legId) {
        const driver = await resolveDriver(userId);
        const leg = await db.routeLeg.findFirst({
            where: { id: legId, route_id: routeId },
            include: { passenger: true },
        });
        if (!leg)
            throw ResponseHandler_1.ResponseHandler.notFound("Route leg not found");
        const seg = await db.routeSegment.findFirst({
            where: {
                route_id: routeId,
                status: "ONGOING",
                batch_id: leg.batch_id,
            },
        });
        if (!seg)
            throw ResponseHandler_1.ResponseHandler.badRequest("No active segment for this leg / batch");
        const config = await db.driverConfiguration.findFirst();
        if (seg.kind === "PICKUP_TO_OFFICE") {
            await db.routeLeg.update({
                where: { id: legId },
                data: {
                    pickup_status: "ARRIVED",
                    driver_arrived_at: new Date(),
                },
            });
        }
        else {
            await db.routeLeg.update({
                where: { id: legId },
                data: {
                    dropoff_status: "ARRIVED",
                    dropoff_arrived_at: new Date(),
                },
            });
        }
        (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:arrived", {
            driverId: driver.id,
            driverName: driver.name,
            routeId,
            legId,
            passenger: { id: leg.passenger.id, name: leg.passenger.name },
            phase: seg.kind,
            arrived_at: new Date(),
        });
        return {
            leg_id: legId,
            passenger: { id: leg.passenger.id, name: leg.passenger.name },
            execution_kind: seg.kind,
            config: {
                still_waiting_button_appear_in: config?.still_waiting_button_appear_in,
                passenger_waiting_time: config?.passenger_waiting_time,
                skip_button_appear_in: config?.skip_button_appear_in,
            },
        };
    },
    async legAction(userId, routeId, legId, action) {
        const driver = await resolveDriver(userId);
        const leg = await db.routeLeg.findFirst({
            where: { id: legId, route_id: routeId },
            include: { passenger: true },
        });
        if (!leg)
            throw ResponseHandler_1.ResponseHandler.notFound("Route leg not found");
        const seg = await db.routeSegment.findFirst({
            where: {
                route_id: routeId,
                status: "ONGOING",
                batch_id: leg.batch_id,
            },
        });
        if (!seg)
            throw ResponseHandler_1.ResponseHandler.badRequest("No active segment for this leg");
        const isPickup = seg.kind === "PICKUP_TO_OFFICE";
        if (isPickup) {
            if (action === "PICKED") {
                await db.routeLeg.update({
                    where: { id: legId },
                    data: { pickup_status: "PICKED", picked_at: new Date() },
                });
            }
            else if (action === "MOVE_TO_NEXT") {
                await db.routeLeg.update({
                    where: { id: legId },
                    data: { pickup_status: "SKIPPED" },
                });
            }
            (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:action", {
                action,
                legId,
                routeId,
                phase: "PICKUP",
            });
            const nextLeg = await db.routeLeg.findFirst({
                where: {
                    route_id: routeId,
                    batch_id: leg.batch_id,
                    pickup_status: "PENDING",
                    id: { not: legId },
                },
                include: { passenger: true },
                orderBy: { sequence: "asc" },
            });
            if (!nextLeg) {
                const pendingCount = await db.routeLeg.count({
                    where: {
                        route_id: routeId,
                        batch_id: leg.batch_id,
                        pickup_status: { in: ["PENDING", "ARRIVED"] },
                    },
                });
                if (pendingCount === 0) {
                    return {
                        action,
                        next_passenger: null,
                        navigate_to_office: true,
                        message: "Batch pickup complete. Drive to office, then call office-checkpoint.",
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
            (0, socketService_1.emitToDriver)(driver.id, "next:passenger", nextLeg
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
                : null);
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
            await db.routeLeg.update({
                where: { id: legId },
                data: { dropoff_status: "DROPPED", dropped_at: new Date() },
            });
        }
        else if (action === "MOVE_TO_NEXT") {
            await db.routeLeg.update({
                where: { id: legId },
                data: { dropoff_status: "SKIPPED" },
            });
        }
        (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:action", {
            action,
            legId,
            routeId,
            phase: "DROP",
        });
        const nextDrop = await db.routeLeg.findFirst({
            where: {
                route_id: routeId,
                batch_id: leg.batch_id,
                dropoff_status: "PENDING",
                id: { not: legId },
            },
            include: { passenger: true },
            orderBy: { drop_sequence: "asc" },
        });
        if (!nextDrop) {
            const pendingDrop = await db.routeLeg.count({
                where: {
                    route_id: routeId,
                    batch_id: leg.batch_id,
                    dropoff_status: { in: ["PENDING", "ARRIVED"] },
                },
            });
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
                    await routeService.syncRouteDisplayDirections(routeId);
                    return {
                        action,
                        next_passenger: null,
                        navigate_to_office: nextSeg.kind === "PICKUP_TO_OFFICE",
                        message: nextSeg.kind === "PICKUP_TO_OFFICE"
                            ? "Next batch: pickups. Follow updated route."
                            : "Next: drop segment. Follow updated route.",
                        execution_kind: nextSeg.kind,
                        route_continues: true,
                    };
                }
                await db.route.update({
                    where: { id: routeId },
                    data: { status: "COMPLETED", completed_at: new Date() },
                });
                await db.driver.update({
                    where: { id: driver.id },
                    data: { is_available: false, available_at: null },
                });
                const route = await db.route.findUnique({
                    where: { id: routeId },
                    include: { legs: { select: { passenger_id: true } } },
                });
                if (route) {
                    (0, socketService_1.emitToPassengers)(route.legs.map((l) => l.passenger_id), "ride:completed", {
                        routeId,
                        driverId: driver.id,
                        completed_at: new Date(),
                    });
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
        (0, socketService_1.emitToDriver)(driver.id, "next:passenger", nextDrop
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
            : null);
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
    async officeCheckpoint(userId, routeId) {
        const driver = await resolveDriver(userId);
        const seg = await db.routeSegment.findFirst({
            where: {
                route_id: routeId,
                status: "ONGOING",
                kind: "PICKUP_TO_OFFICE",
            },
            include: { batch: true },
        });
        if (!seg) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Office checkpoint only applies after an active pickup segment");
        }
        const pending = await db.routeLeg.count({
            where: {
                batch_id: seg.batch_id,
                pickup_status: { in: ["PENDING", "ARRIVED"] },
            },
        });
        if (pending > 0) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Complete or skip all pickups in this batch before office checkpoint");
        }
        await db.routeSegment.update({
            where: { id: seg.id },
            data: { status: "COMPLETED" },
        });
        const nextSeg = await db.routeSegment.findFirst({
            where: { route_id: routeId, status: "PENDING" },
            orderBy: { segment_order: "asc" },
        });
        if (!nextSeg) {
            throw ResponseHandler_1.ResponseHandler.badRequest("No next segment");
        }
        await db.routeSegment.update({
            where: { id: nextSeg.id },
            data: { status: "ONGOING" },
        });
        await routeService.syncRouteDisplayDirections(routeId);
        return {
            next_segment_kind: nextSeg.kind,
            batch_id: nextSeg.batch_id,
            message: nextSeg.kind === "PICKUP_TO_OFFICE"
                ? "Continue with next pickup batch."
                : "Start drop-offs. Route updated.",
        };
    },
    /**
     * Optional explicit finish when the last drop is done (route may already auto-complete in legAction).
     */
    async completeTrip(userId, routeId) {
        const driver = await resolveDriver(userId);
        const route = await db.route.findFirst({
            where: { id: routeId, driver_id: driver.id, status: "ONGOING" },
        });
        if (!route)
            throw ResponseHandler_1.ResponseHandler.notFound("Active route not found");
        const incomplete = await db.routeSegment.count({
            where: {
                route_id: routeId,
                status: { not: "COMPLETED" },
            },
        });
        if (incomplete > 0) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Finish all segments (use office-checkpoint between pickups, complete drops) before completing");
        }
        await db.route.update({
            where: { id: routeId },
            data: { status: "COMPLETED", completed_at: new Date() },
        });
        await db.driver.update({
            where: { id: driver.id },
            data: { is_available: false, available_at: null },
        });
        const r = await db.route.findUnique({
            where: { id: routeId },
            include: { legs: { select: { passenger_id: true } } },
        });
        if (r) {
            (0, socketService_1.emitToPassengers)(r.legs.map((l) => l.passenger_id), "ride:completed", {
                routeId,
                driverId: driver.id,
                completed_at: new Date(),
            });
        }
        return { route_id: routeId, status: "COMPLETED" };
    },
};

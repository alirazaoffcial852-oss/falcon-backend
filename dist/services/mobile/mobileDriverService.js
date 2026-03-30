"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileDriverService = void 0;
const database_1 = require("../../config/database");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const socketService_1 = require("../../config/socketService");
const db = database_1.DatabaseService.getInstance().getPrisma();
// ---------- helpers ----------
/** Haversine distance in km between two lat/long points */
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
/** Resolve driver record from the user account */
async function resolveDriver(userId) {
    const driver = await db.driver.findUnique({ where: { user_id: userId } });
    if (!driver)
        throw ResponseHandler_1.ResponseHandler.notFound("Driver profile not found");
    return driver;
}
// ---------- service methods ----------
exports.MobileDriverService = {
    /**
     * Driver slides "Go Available".
     * Sets is_available = true, broadcasts to all passengers on today's PENDING route.
     */
    async goAvailable(userId) {
        const driver = await resolveDriver(userId);
        // Get driver configuration for availability duration
        const config = await db.driverConfiguration.findFirst();
        if (!config)
            throw ResponseHandler_1.ResponseHandler.notFound("Driver configuration not found");
        // Mark driver available
        const updatedDriver = await db.driver.update({
            where: { id: driver.id },
            data: {
                is_available: true,
                available_at: new Date(),
            },
        });
        // Find today's PENDING routes assigned to this driver
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
                legs: {
                    include: { passenger: true },
                },
                driver: {
                    include: {
                        driver_assign_cars: { include: { car: true }, take: 1 },
                    },
                },
            },
        });
        // Notify all passengers on those routes
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
        return {
            driver: { id: driver.id, name: driver.name, is_available: true },
            routes: routes.map((r) => ({ id: r.id, passengers_count: r.legs.length })),
            config: {
                availability_time: config.availability_time,
                remaining_start_time: config.remaining_start_time,
            },
        };
    },
    /**
     * Get driver's current active route with passengers sorted by nearest.
     */
    async getSession(userId) {
        const driver = await resolveDriver(userId);
        const config = await db.driverConfiguration.findFirst();
        // Find the PENDING or ONGOING route for today
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
                legs: {
                    where: { pickup_status: { in: ["PENDING", "ARRIVED"] } },
                    include: { passenger: true },
                },
            },
            orderBy: { id: "desc" },
        });
        if (!route) {
            return {
                route: null,
                driver: {
                    id: driver.id,
                    is_available: driver.is_available,
                    current_lat: driver.current_lat,
                    current_long: driver.current_long,
                },
                config,
            };
        }
        // Sort remaining legs by distance from driver's current location
        let sortedLegs = route.legs;
        if (driver.current_lat !== null && driver.current_long !== null) {
            sortedLegs = [...route.legs].sort((a, b) => {
                const distA = haversineKm(driver.current_lat, driver.current_long, a.pickup_lat, a.pickup_long);
                const distB = haversineKm(driver.current_lat, driver.current_long, b.pickup_lat, b.pickup_long);
                return distA - distB;
            });
        }
        return {
            route: {
                id: route.id,
                status: route.status,
                office_address: route.office_address,
                office_lat: route.office_lat,
                office_long: route.office_long,
                started_at: route.started_at,
                passengers_queue: sortedLegs.map((leg, idx) => ({
                    queue_position: idx + 1,
                    leg_id: leg.id,
                    sequence: leg.sequence,
                    passenger: {
                        id: leg.passenger.id,
                        name: leg.passenger.name,
                        phone_no: leg.passenger.phone_no,
                    },
                    pickup_address: leg.pickup_address,
                    pickup_lat: leg.pickup_lat,
                    pickup_long: leg.pickup_long,
                    pickup_time: leg.pickup_time,
                    pickup_status: leg.pickup_status,
                    passenger_ack: leg.passenger_ack,
                    distance_km: driver.current_lat !== null && driver.current_long !== null
                        ? haversineKm(driver.current_lat, driver.current_long, leg.pickup_lat, leg.pickup_long).toFixed(2)
                        : null,
                })),
            },
            driver: {
                id: driver.id,
                is_available: driver.is_available,
                current_lat: driver.current_lat,
                current_long: driver.current_long,
            },
            config,
        };
    },
    /**
     * Driver clicks "Start" — route moves to ONGOING.
     */
    async startTrip(userId, routeId) {
        const driver = await resolveDriver(userId);
        const route = await db.route.findFirst({
            where: { id: routeId, driver_id: driver.id, status: "PENDING" },
            include: {
                legs: {
                    include: { passenger: true },
                    orderBy: { sequence: "asc" },
                },
                driver: {
                    include: {
                        driver_assign_cars: { include: { car: true }, take: 1 },
                    },
                },
            },
        });
        if (!route)
            throw ResponseHandler_1.ResponseHandler.notFound("Route not found or already started");
        await db.route.update({
            where: { id: routeId },
            data: { status: "ONGOING", started_at: new Date() },
        });
        const config = await db.driverConfiguration.findFirst();
        // Sort legs by nearest to driver
        let sortedLegs = route.legs;
        if (driver.current_lat !== null && driver.current_long !== null) {
            sortedLegs = [...route.legs].sort((a, b) => {
                const distA = haversineKm(driver.current_lat, driver.current_long, a.pickup_lat, a.pickup_long);
                const distB = haversineKm(driver.current_lat, driver.current_long, b.pickup_lat, b.pickup_long);
                return distA - distB;
            });
        }
        // Update sequence based on sorted order
        await db.$transaction(sortedLegs.map((leg, idx) => db.routeLeg.update({
            where: { id: leg.id },
            data: { sequence: idx + 1 },
        })));
        const car = route.driver.driver_assign_cars[0]?.car ?? null;
        // Notify all passengers
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
        return {
            route_id: routeId,
            status: "ONGOING",
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
    /**
     * Update driver's live location.
     */
    async updateLocation(userId, lat, long) {
        const driver = await resolveDriver(userId);
        await db.driver.update({
            where: { id: driver.id },
            data: { current_lat: lat, current_long: long, location_updated_at: new Date() },
        });
        // Find active route and notify its passengers
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
            (0, socketService_1.emitToPassengers)(passengerIds, "driver:location", {
                driverId: driver.id,
                lat,
                long,
                updated_at: new Date(),
            });
        }
        return { lat, long };
    },
    /**
     * Driver clicks "I am Here" at passenger pickup point.
     */
    async arriveAtPassenger(userId, routeId, legId) {
        const driver = await resolveDriver(userId);
        const leg = await db.routeLeg.findFirst({
            where: { id: legId, route_id: routeId },
            include: { passenger: true },
        });
        if (!leg)
            throw ResponseHandler_1.ResponseHandler.notFound("Route leg not found");
        const config = await db.driverConfiguration.findFirst();
        await db.routeLeg.update({
            where: { id: legId },
            data: {
                pickup_status: "ARRIVED",
                driver_arrived_at: new Date(),
            },
        });
        // Notify passenger: driver has arrived
        (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:arrived", {
            driverId: driver.id,
            driverName: driver.name,
            routeId,
            legId,
            passenger: { id: leg.passenger.id, name: leg.passenger.name },
            arrived_at: new Date(),
        });
        return {
            leg_id: legId,
            passenger: { id: leg.passenger.id, name: leg.passenger.name },
            config: {
                still_waiting_button_appear_in: config?.still_waiting_button_appear_in,
                passenger_waiting_time: config?.passenger_waiting_time,
                skip_button_appear_in: config?.skip_button_appear_in,
            },
        };
    },
    /**
     * Driver action after arriving: PICKED | STILL_WAITING | MOVE_TO_NEXT
     */
    async legAction(userId, routeId, legId, action) {
        const driver = await resolveDriver(userId);
        const leg = await db.routeLeg.findFirst({
            where: { id: legId, route_id: routeId },
            include: { passenger: true },
        });
        if (!leg)
            throw ResponseHandler_1.ResponseHandler.notFound("Route leg not found");
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
        // STILL_WAITING: no status change, just acknowledged
        // Notify the current passenger of the action
        (0, socketService_1.emitToPassenger)(leg.passenger_id, "driver:action", {
            action,
            legId,
            routeId,
        });
        // Get the next pending passenger
        const nextLeg = await db.routeLeg.findFirst({
            where: {
                route_id: routeId,
                pickup_status: "PENDING",
                id: { not: legId },
            },
            include: { passenger: true },
            orderBy: { sequence: "asc" },
        });
        // If no more pending legs, check if trip is complete
        if (!nextLeg) {
            // Check all legs done
            const pendingCount = await db.routeLeg.count({
                where: { route_id: routeId, pickup_status: { in: ["PENDING", "ARRIVED"] } },
            });
            if (pendingCount === 0) {
                // All picked/skipped → navigate to office
                return {
                    action,
                    next_passenger: null,
                    navigate_to_office: true,
                    message: "All passengers processed. Navigate to office.",
                };
            }
        }
        (0, socketService_1.emitToDriver)(driver.id, "next:passenger", nextLeg
            ? {
                leg_id: nextLeg.id,
                passenger: { id: nextLeg.passenger.id, name: nextLeg.passenger.name },
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
                    passenger: { id: nextLeg.passenger.id, name: nextLeg.passenger.name },
                    pickup_address: nextLeg.pickup_address,
                    pickup_lat: nextLeg.pickup_lat,
                    pickup_long: nextLeg.pickup_long,
                }
                : null,
            navigate_to_office: !nextLeg,
        };
    },
    /**
     * Driver clicks "Ride Completed" after reaching office.
     */
    async completeTrip(userId, routeId) {
        const driver = await resolveDriver(userId);
        const route = await db.route.findFirst({
            where: { id: routeId, driver_id: driver.id, status: "ONGOING" },
            include: { legs: { select: { passenger_id: true } } },
        });
        if (!route)
            throw ResponseHandler_1.ResponseHandler.notFound("Active route not found");
        await db.route.update({
            where: { id: routeId },
            data: { status: "COMPLETED", completed_at: new Date() },
        });
        // Reset driver availability
        await db.driver.update({
            where: { id: driver.id },
            data: { is_available: false, available_at: null },
        });
        const passengerIds = route.legs.map((l) => l.passenger_id);
        (0, socketService_1.emitToPassengers)(passengerIds, "ride:completed", {
            routeId,
            driverId: driver.id,
            completed_at: new Date(),
        });
        return { route_id: routeId, status: "COMPLETED" };
    },
};

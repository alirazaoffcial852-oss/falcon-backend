"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteService = void 0;
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const buildWhereCondition_1 = require("../utils/buildWhereCondition");
const googleDirections_1 = require("../utils/googleDirections");
const geocodeAddress_1 = require("../utils/geocodeAddress");
const recurringPlan_1 = require("../utils/recurringPlan");
class RouteService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    distanceKm(a, b) {
        const R = 6371;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLon = ((b.lng - a.lng) * Math.PI) / 180;
        const lat1 = (a.lat * Math.PI) / 180;
        const lat2 = (b.lat * Math.PI) / 180;
        const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    }
    /** Nearest-first sort uses driver home (batch 1) or office (batch 2+). Polyline does NOT include this point. */
    async ensureDriverHomeLatLng(driverId) {
        const driver = await this.db.driver.findUnique({ where: { id: driverId } });
        if (!driver)
            throw ResponseHandler_1.ResponseHandler.notFound("Driver not found");
        if (driver.home_lat != null && driver.home_long != null) {
            return { lat: driver.home_lat, lng: driver.home_long };
        }
        const geo = await (0, geocodeAddress_1.geocodeAddressToLatLng)(driver.address);
        await this.db.driver.update({
            where: { id: driverId },
            data: { home_lat: geo.lat, home_long: geo.lng },
        });
        return geo;
    }
    mapLegCreate(leg) {
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
    async optimizeBatchPickup(batchId, sortOrigin, office) {
        const batch = await this.db.routeBatch.findUnique({
            where: { id: batchId },
            include: {
                route: { select: { id: true, driver_id: true } },
                legs: { orderBy: { id: "asc" } },
            },
        });
        if (!batch || batch.legs.length === 0)
            return;
        if (!process.env.GOOGLE_MAPS_API_KEY)
            return;
        let sortPoint;
        if (sortOrigin === "driver_home") {
            sortPoint = await this.ensureDriverHomeLatLng(batch.route.driver_id);
        }
        else {
            sortPoint = office;
        }
        const rawWaypoints = batch.legs.map((leg, idx) => ({
            idx,
            point: { lat: leg.pickup_lat, lng: leg.pickup_long },
        }));
        const orderedWaypoints = rawWaypoints
            .slice()
            .sort((a, b) => this.distanceKm(sortPoint, a.point) - this.distanceKm(sortPoint, b.point));
        const waypointOrder = orderedWaypoints.map((w) => w.idx);
        const pickupPoints = orderedWaypoints.map((w) => w.point);
        const origin = pickupPoints[0];
        const destination = office;
        const waypoints = pickupPoints.length > 1 ? pickupPoints.slice(1) : [];
        const finalDirections = await (0, googleDirections_1.fetchGoogleDirections)({
            origin,
            destination,
            waypoints,
            optimizeWaypoints: false,
        });
        const polyline = finalDirections.overview_polyline?.points ?? null;
        const totalDistance = (finalDirections.legs ?? []).reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
        const totalDuration = (finalDirections.legs ?? []).reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
        await this.db.$transaction(async (tx) => {
            for (let idx = 0; idx < waypointOrder.length; idx++) {
                const origIdx = waypointOrder[idx];
                const leg = batch.legs[origIdx];
                if (!leg)
                    continue;
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
    async optimizeBatchDrop(batchId, office) {
        const batch = await this.db.routeBatch.findUnique({
            where: { id: batchId },
            include: {
                legs: { orderBy: { sequence: "desc" } },
            },
        });
        if (!batch || batch.legs.length === 0)
            return;
        if (!process.env.GOOGLE_MAPS_API_KEY)
            return;
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
        if (!reloaded)
            return;
        const orderedHomes = reloaded.legs.map((leg) => ({
            lat: leg.dropoff_lat,
            lng: leg.dropoff_long,
        }));
        const origin = office;
        let finalDirections;
        if (orderedHomes.length === 1) {
            finalDirections = await (0, googleDirections_1.fetchGoogleDirections)({
                origin,
                destination: orderedHomes[0],
                waypoints: [],
                optimizeWaypoints: false,
            });
        }
        else {
            finalDirections = await (0, googleDirections_1.fetchGoogleDirections)({
                origin,
                destination: orderedHomes[orderedHomes.length - 1],
                waypoints: orderedHomes.slice(0, -1),
                optimizeWaypoints: false,
            });
        }
        const polyline = finalDirections.overview_polyline?.points ?? null;
        const waypointOrder = reloaded.legs.map((_, i) => i);
        const totalDistance = (finalDirections.legs ?? []).reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
        const totalDuration = (finalDirections.legs ?? []).reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0);
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
    async optimizeAllBatches(routeId) {
        const route = await this.db.route.findUnique({
            where: { id: routeId },
            include: { batches: { orderBy: { batch_order: "asc" } } },
        });
        if (!route)
            return;
        const office = {
            lat: route.office_lat,
            lng: route.office_long,
        };
        for (const b of route.batches) {
            const sortOrigin = b.batch_order === 1 ? "driver_home" : "office";
            await this.optimizeBatchPickup(b.id, sortOrigin, office);
            await this.optimizeBatchDrop(b.id, office);
        }
    }
    /** Default 1-month recurring window unless `recurringPlanMonths: 0`. */
    computeRecurringPlanForCreate(data) {
        const months = data.recurringPlanMonths ?? 1;
        if (months <= 0)
            return null;
        const start = data.recurringPlanStartDate
            ? (0, recurringPlan_1.parseLocalYmd)(data.recurringPlanStartDate)
            : (0, recurringPlan_1.getTomorrowLocalDateOnly)();
        const end = (0, recurringPlan_1.computeInclusivePlanEnd)(start, months);
        return { start, end };
    }
    normalizeCreateBatches(data) {
        if (data.batches?.length)
            return data.batches;
        const legs = data.legs;
        if (legs?.length)
            return [{ legs }];
        throw ResponseHandler_1.ResponseHandler.badRequest("Provide batches (array) or legacy legs array");
    }
    async list(params) {
        const where = (0, buildWhereCondition_1.buildWhereCondition)({
            page: params.page,
            limit: params.limit,
            search: params.search,
        }, ["office_address"], []);
        if (params.companyId !== undefined)
            where.company_id = params.companyId;
        if (params.driverId !== undefined)
            where.driver_id = params.driverId;
        // Admin list: definition routes only (trip state is on RouteDailyPlan).
        where.route_daily_plan_id = null;
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
    async getById(id) {
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
            throw ResponseHandler_1.ResponseHandler.notFound("No route found against this id: " + id);
        return route;
    }
    async create(data) {
        const batchInputs = this.normalizeCreateBatches(data);
        const recurringPlan = this.computeRecurringPlanForCreate(data);
        const route = await this.db.$transaction(async (tx) => {
            const created = await tx.route.create({
                data: {
                    company_id: data.companyId,
                    driver_id: data.driverId,
                    office_address: data.officeAddress.trim(),
                    office_lat: data.officeLat,
                    office_long: data.officeLong,
                    ...(recurringPlan && {
                        recurring_plan_start: recurringPlan.start,
                        recurring_plan_end: recurringPlan.end,
                    }),
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
    async update(id, data) {
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
        }
        else {
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
        if (data.recurringPlanStartDate !== undefined ||
            data.recurringPlanMonths !== undefined) {
            const r = await this.db.route.findUnique({ where: { id } });
            if (!r)
                throw ResponseHandler_1.ResponseHandler.notFound("Route not found");
            if (r.route_daily_plan_id != null) {
                throw ResponseHandler_1.ResponseHandler.badRequest("Recurring plan can only be set on definition routes");
            }
            const months = data.recurringPlanMonths ?? 1;
            if (months <= 0) {
                await this.db.route.update({
                    where: { id },
                    data: {
                        recurring_plan_start: null,
                        recurring_plan_end: null,
                    },
                });
            }
            else {
                const start = data.recurringPlanStartDate
                    ? (0, recurringPlan_1.parseLocalYmd)(data.recurringPlanStartDate)
                    : r.recurring_plan_start ?? (0, recurringPlan_1.getTomorrowLocalDateOnly)();
                const end = (0, recurringPlan_1.computeInclusivePlanEnd)(start, months);
                await this.db.route.update({
                    where: { id },
                    data: {
                        recurring_plan_start: start,
                        recurring_plan_end: end,
                    },
                });
            }
        }
        return this.getById(id);
    }
    async optimizeById(id) {
        await this.getById(id);
        await this.optimizeAllBatches(id);
        return this.getById(id);
    }
    /**
     * Create RouteDailyPlan + execution Route (clone) for one calendar day.
     * `definitionRouteId` must be a definition row (`route_daily_plan_id` is null).
     */
    async createDailyPlanWithExecution(definitionRouteId, day) {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        const definition = await this.db.route.findUnique({
            where: { id: definitionRouteId },
            include: {
                batches: {
                    orderBy: { batch_order: "asc" },
                    include: { legs: { orderBy: { sequence: "asc" } } },
                },
            },
        });
        if (!definition)
            throw ResponseHandler_1.ResponseHandler.notFound("Route definition", definitionRouteId);
        if (definition.route_daily_plan_id != null) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Use a definition route id (not an execution route)");
        }
        if (definition.recurring_plan_start &&
            definition.recurring_plan_end &&
            !(0, recurringPlan_1.isDateInPlanWindow)(dayStart, definition.recurring_plan_start, definition.recurring_plan_end)) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Date is outside this route's recurring plan window");
        }
        const dup = await this.db.routeDailyPlan.findFirst({
            where: {
                definition_route_id: definitionRouteId,
                scheduled_date: { gte: dayStart, lt: dayEnd },
            },
        });
        if (dup) {
            throw ResponseHandler_1.ResponseHandler.badRequest("A daily plan already exists for this definition on this date");
        }
        const hol = await this.db.companyHoliday.findUnique({
            where: {
                company_id_date: {
                    company_id: definition.company_id,
                    date: dayStart,
                },
            },
        });
        if (hol) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Company holiday on this date — plan not created");
        }
        const leave = await this.db.driverLeave.findUnique({
            where: {
                driver_id_date: {
                    driver_id: definition.driver_id,
                    date: dayStart,
                },
            },
        });
        if (leave) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Driver on leave this date — plan not created");
        }
        const createdExecId = await this.db.$transaction(async (tx) => {
            const plan = await tx.routeDailyPlan.create({
                data: {
                    definition_route_id: definitionRouteId,
                    scheduled_date: dayStart,
                    status: "PENDING",
                },
            });
            const newRoute = await tx.route.create({
                data: {
                    company_id: definition.company_id,
                    driver_id: definition.driver_id,
                    office_address: definition.office_address,
                    office_lat: definition.office_lat,
                    office_long: definition.office_long,
                    route_daily_plan_id: plan.id,
                },
            });
            // Freeze who was assigned for this daily plan (pickup + drop),
            // so later admin updates to `routes.driver_id` won't rewrite reports.
            await tx.routeDailyPlanPhaseDriver.createMany({
                data: [
                    {
                        route_daily_plan_id: plan.id,
                        phase: "PICKUP",
                        driver_id: definition.driver_id,
                        phase_started_at: null,
                    },
                    {
                        route_daily_plan_id: plan.id,
                        phase: "DROP",
                        driver_id: definition.driver_id,
                        phase_started_at: null,
                    },
                ],
            });
            for (const batch of definition.batches) {
                await tx.routeBatch.create({
                    data: {
                        route_id: newRoute.id,
                        batch_order: batch.batch_order,
                        legs: {
                            create: batch.legs.map((leg) => ({
                                route_id: newRoute.id,
                                passenger_id: leg.passenger_id,
                                pickup_address: leg.pickup_address,
                                pickup_lat: leg.pickup_lat,
                                pickup_long: leg.pickup_long,
                                pickup_time: leg.pickup_time,
                                pickup_status: "PENDING",
                                driver_arrived_at: null,
                                passenger_ack: null,
                                picked_at: null,
                                dropoff_address: leg.dropoff_address,
                                dropoff_lat: leg.dropoff_lat,
                                dropoff_long: leg.dropoff_long,
                                dropoff_time: leg.dropoff_time,
                                dropoff_status: "PENDING",
                                dropoff_arrived_at: null,
                                dropped_at: null,
                                toll_amount: leg.toll_amount,
                                sequence: leg.sequence,
                                drop_sequence: leg.drop_sequence,
                            })),
                        },
                    },
                });
            }
            const orderedBatches = await tx.routeBatch.findMany({
                where: { route_id: newRoute.id },
                orderBy: { batch_order: "asc" },
            });
            let segmentOrder = 0;
            for (const b of orderedBatches) {
                await tx.routeSegment.create({
                    data: {
                        route_id: newRoute.id,
                        segment_order: segmentOrder++,
                        batch_id: b.id,
                        kind: "PICKUP_TO_OFFICE",
                        status: "PENDING",
                    },
                });
            }
            for (const b of orderedBatches) {
                await tx.routeSegment.create({
                    data: {
                        route_id: newRoute.id,
                        segment_order: segmentOrder++,
                        batch_id: b.id,
                        kind: "DROP_TO_HOMES",
                        status: "PENDING",
                    },
                });
            }
            return newRoute.id;
        });
        await this.optimizeAllBatches(createdExecId);
        return this.getById(createdExecId);
    }
    /** @deprecated alias */
    async cloneTemplateToInstance(definitionRouteId, day) {
        return this.createDailyPlanWithExecution(definitionRouteId, day);
    }
    /**
     * For each definition route, create daily plan + execution unless duplicate / holiday / leave.
     * @param plannedOnly - cron: only definitions with recurring window covering `forDay`.
     */
    async generateDailyInstancesForDate(forDay = new Date(), options) {
        const dayStart = new Date(forDay);
        dayStart.setHours(0, 0, 0, 0);
        const where = {
            route_daily_plan_id: null,
        };
        if (options?.plannedOnly) {
            where.recurring_plan_start = { lte: dayStart };
            where.recurring_plan_end = { gte: dayStart };
        }
        const definitions = await this.db.route.findMany({ where });
        const created = [];
        const skipped = [];
        for (const d of definitions) {
            try {
                const route = await this.createDailyPlanWithExecution(d.id, dayStart);
                created.push(route.id);
            }
            catch (e) {
                const err = e;
                skipped.push({
                    definitionRouteId: d.id,
                    reason: err?.message ?? "unknown error",
                });
            }
        }
        return { created, skipped };
    }
    /** Per-day passenger counts from RouteDailyPlan + execution route legs. */
    async getTemplatePlanStats(definitionRouteId, from, to) {
        const def = await this.db.route.findUnique({
            where: { id: definitionRouteId },
        });
        if (!def)
            throw ResponseHandler_1.ResponseHandler.notFound("Route definition", definitionRouteId);
        if (def.route_daily_plan_id != null) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Use a definition route id for plan stats");
        }
        const fromDay = (0, recurringPlan_1.getLocalDateOnly)(from);
        const toDay = (0, recurringPlan_1.getLocalDateOnly)(to);
        const plans = await this.db.routeDailyPlan.findMany({
            where: {
                definition_route_id: definitionRouteId,
                scheduled_date: { gte: fromDay, lte: toDay },
            },
            include: {
                execution_route: {
                    include: {
                        _count: { select: { legs: true } },
                    },
                },
            },
            orderBy: { scheduled_date: "asc" },
        });
        return {
            definition_route_id: definitionRouteId,
            recurring_plan_start: def.recurring_plan_start,
            recurring_plan_end: def.recurring_plan_end,
            days: plans.map((p) => ({
                date: p.scheduled_date,
                plan_id: p.id,
                route_id: p.execution_route?.id ?? null,
                passenger_count: p.execution_route?._count.legs ?? 0,
                status: p.status,
            })),
        };
    }
    async delete(id) {
        await this.getById(id);
        await this.db.route.delete({ where: { id } });
    }
}
exports.RouteService = RouteService;

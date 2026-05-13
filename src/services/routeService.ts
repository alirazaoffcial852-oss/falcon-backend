import { Prisma } from "../generated/prisma/client";
import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type {
	CreateRouteInput,
	UpdateRouteInput,
	RouteListQuery,
	RouteBatchInput,
	RouteLegInput,
} from "../types/admin/route";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import { fetchGoogleDirections, type LatLng } from "../utils/googleDirections";
import { geocodeAddressToLatLng } from "../utils/geocodeAddress";
import {
	computeInclusivePlanEnd,
	getLocalDateOnly,
	getTomorrowLocalDateOnly,
	parseLocalYmd,
} from "../utils/recurringPlan";
import {
	formatSecondsFromMidnightToHHMM,
	getOfficeArrivalBufferMinutes,
	parseTimeToMinutesFromMidnight,
} from "../utils/pickupSchedule";
import { getFirstRouteLegInPickupOrder } from "../utils/routeFirstPickupLeg";

type SortOriginMode = "driver_home" | "office";

export class RouteService {
	private db = DatabaseService.getInstance().getPrisma();

	private async assertDriverApproved(driverId: number): Promise<void> {
		const driver = await this.db.driver.findUnique({
			where: { id: driverId },
			select: { id: true, status: true },
		});
		if (!driver) {
			throw ResponseHandler.badRequest("No driver found against this id");
		}
		if (driver.status !== "APPROVED") {
			throw ResponseHandler.badRequest(
				"Cannot create or assign route to a pending driver",
			);
		}
	}

	private getWeekdayEnum(
		day: Date,
	):
		| "SUNDAY"
		| "MONDAY"
		| "TUESDAY"
		| "WEDNESDAY"
		| "THURSDAY"
		| "FRIDAY"
		| "SATURDAY" {
		const days = [
			"SUNDAY",
			"MONDAY",
			"TUESDAY",
			"WEDNESDAY",
			"THURSDAY",
			"FRIDAY",
			"SATURDAY",
		] as const;
		return days[day.getDay()];
	}

	/**
	 * Sets `trip_start_time` on PICKUP/DROP phase rows: PICKUP = first leg's `pickup_time`,
	 * DROP = same leg's `office_pick_up_time` (batch_order asc, then sequence asc).
	 */
	async setTripStartTimesForDailyPlan(
		routeId: number,
		planId: number,
	): Promise<void> {
		const firstLeg = await getFirstRouteLegInPickupOrder(this.db, routeId);
		if (!firstLeg) return;
		const pickupTime = firstLeg.pickup_time?.trim() ?? null;
		const officePickUp = firstLeg.office_pick_up_time?.trim() ?? null;
		await this.db.routeDailyPlanPhaseDriver.updateMany({
			where: { route_daily_plan_id: planId, phase: "PICKUP" },
			data: { trip_start_time: pickupTime },
		});
		await this.db.routeDailyPlanPhaseDriver.updateMany({
			where: { route_daily_plan_id: planId, phase: "DROP" },
			data: { trip_start_time: officePickUp },
		});
	}

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
		const pickupTime = leg.pickupTime?.trim();
		const dropoffTime = leg.dropoffTime?.trim();
		return {
			passenger_id: leg.passengerId,
			pickup_address: leg.pickupAddress.trim(),
			pickup_lat: leg.pickupLat,
			pickup_long: leg.pickupLong,
			pickup_time: pickupTime || "00:00",
			dropoff_address: leg.dropoffAddress.trim(),
			dropoff_lat: leg.dropoffLat,
			dropoff_long: leg.dropoffLong,
			dropoff_time: dropoffTime || "00:00",
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
					this.distanceKm(sortPoint, a.point) -
					this.distanceKm(sortPoint, b.point),
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
	private async optimizeBatchDrop(
		batchId: number,
		office: LatLng,
	): Promise<void> {
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
	}

	/**
	 * Sets each leg's `pickup_time` / `dropoff_time` from passengers' `drop_off_time`
	 * (office deadline) and Google pickup leg durations: arrive at office
	 * `ROUTE_OFFICE_ARRIVAL_BUFFER_MINUTES` (default 7) before the earliest deadline.
	 */
	private async applyComputedPickupTimesForRoute(
		routeId: number,
	): Promise<void> {
		const route = await this.db.route.findUnique({
			where: { id: routeId },
			include: {
				batches: {
					orderBy: { batch_order: "asc" },
					include: {
						legs: {
							orderBy: { sequence: "asc" },
							include: {
								passenger: {
									select: {
										id: true,
										drop_off_time: true,
										office_pick_up_time: true,
									},
								},
							},
						},
					},
				},
			},
		});
		if (!route) return;

		const bufferSec = getOfficeArrivalBufferMinutes() * 60;

		for (const batch of route.batches) {
			const legs = batch.legs
				.filter((l) => l.sequence >= 1)
				.sort((a, b) => a.sequence - b.sequence);
			if (legs.length === 0) continue;

			const deadlines: number[] = [];
			for (const leg of legs) {
				const raw =
					leg.passenger.drop_off_time?.trim() || leg.dropoff_time?.trim();
				const mins = parseTimeToMinutesFromMidnight(raw ?? "");
				if (mins == null) {
					deadlines.length = 0;
					break;
				}
				deadlines.push(mins);
			}
			if (deadlines.length !== legs.length) continue;

			const minDeadlineMinutes = Math.min(...deadlines);
			const rawJson = batch.pickup_directions_legs;
			let legDurations: number[] = Array.isArray(rawJson)
				? rawJson.map((x) => {
						const o = x as { duration_seconds?: number };
						return Math.max(0, Math.round(Number(o?.duration_seconds ?? 0)));
					})
				: [];

			if (legDurations.length !== legs.length) {
				const total = batch.pickup_duration_seconds;
				if (total != null && total > 0) {
					const n = legs.length;
					const base = Math.floor(total / n);
					const extra = total - base * n;
					legDurations = [];
					for (let i = 0; i < n; i++) {
						legDurations.push(base + (i < extra ? 1 : 0));
					}
				} else {
					continue;
				}
			}

			const sumPickupToOffice = legDurations.reduce((a, b) => a + b, 0);
			if (sumPickupToOffice <= 0) continue;

			const deadlineSec = minDeadlineMinutes * 60;
			const targetArrivalSec = deadlineSec - bufferSec;
			const tFirstPickupSec = targetArrivalSec - sumPickupToOffice;

			let cumBefore = 0;
			const officeHHMM = formatSecondsFromMidnightToHHMM(targetArrivalSec);

			for (let i = 0; i < legs.length; i++) {
				const arrivalSec = tFirstPickupSec + cumBefore;
				const pickupHHMM = formatSecondsFromMidnightToHHMM(arrivalSec);

				await this.db.routeLeg.update({
					where: { id: legs[i].id },
					data: {
						pickup_time: pickupHHMM,
						dropoff_time: officeHHMM,
						office_pick_up_time:
							legs[i].passenger.office_pick_up_time?.trim() ?? null,
					},
				});

				await this.db.passenger.update({
					where: { id: legs[i].passenger_id },
					data: { pick_up_time: pickupHHMM },
					select: { id: true },
				});

				cumBefore += legDurations[i] ?? 0;
			}
		}
	}

	/** Default 1-month recurring window unless `recurringPlanMonths: 0`. */
	private computeRecurringPlanForCreate(
		data: CreateRouteInput & { legs?: RouteBatchInput["legs"] },
	): { start: Date; end: Date } | null {
		const months = data.recurringPlanMonths ?? 1;
		if (months <= 0) return null;
		const startInput = data.recurring_plan_start ?? data.recurringPlanStartDate;
		const start = startInput
			? parseLocalYmd(startInput)
			: getTomorrowLocalDateOnly();
		const end = computeInclusivePlanEnd(start, months);
		return { start, end };
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

	private formatDateOnlyYmd(d: Date): string {
		const x = getLocalDateOnly(d);
		const y = x.getUTCFullYear();
		const mo = String(x.getUTCMonth() + 1).padStart(2, "0");
		const day = String(x.getUTCDate()).padStart(2, "0");
		return `${y}-${mo}-${day}`;
	}

	/** Match `computeInclusivePlanEnd` window used at create time. */
	private inferRecurringMonthsFromWindow(start: Date, end: Date): number {
		const endT = getLocalDateOnly(end).getTime();
		for (let months = 1; months <= 36; months++) {
			const planEnd = computeInclusivePlanEnd(getLocalDateOnly(start), months);
			if (planEnd.getTime() >= endT) return months;
		}
		return 36;
	}

	private mapDbLegToRouteLegInput(leg: {
		passenger_id: number;
		pickup_address: string;
		pickup_lat: number;
		pickup_long: number;
		pickup_time: string;
		dropoff_address: string;
		dropoff_lat: number;
		dropoff_long: number;
		dropoff_time: string;
		toll_amount: number | null;
	}): RouteLegInput {
		return {
			passengerId: leg.passenger_id,
			pickupAddress: leg.pickup_address,
			pickupLat: leg.pickup_lat,
			pickupLong: leg.pickup_long,
			pickupTime: leg.pickup_time,
			dropoffAddress: leg.dropoff_address,
			dropoffLat: leg.dropoff_lat,
			dropoffLong: leg.dropoff_long,
			dropoffTime: leg.dropoff_time,
			tollAmount: leg.toll_amount ?? null,
		};
	}

	private existingRouteToBatches(
		route: NonNullable<Awaited<ReturnType<typeof this.getById>>>,
	): RouteBatchInput[] {
		if (route.batches?.length) {
			return route.batches.map((batch) => ({
				legs: [...batch.legs]
					.sort((a, b) => a.sequence - b.sequence)
					.map((leg) => this.mapDbLegToRouteLegInput(leg)),
			}));
		}
		if (route.legs?.length) {
			return [
				{
					legs: [...route.legs]
						.sort((a, b) => a.sequence - b.sequence)
						.map((leg) => this.mapDbLegToRouteLegInput(leg)),
				},
			];
		}
		throw ResponseHandler.badRequest(
			"Source route has no batches or legs — send batches in the body or fix the source route",
		);
	}

	private mergeRecurringForkPayload(
		existing: NonNullable<Awaited<ReturnType<typeof this.getById>>>,
		data: UpdateRouteInput,
	): Partial<
		Pick<
			CreateRouteInput,
			"recurringPlanStartDate" | "recurring_plan_start" | "recurringPlanMonths"
		>
	> {
		if (
			data.recurringPlanStartDate !== undefined ||
			data.recurring_plan_start !== undefined ||
			data.recurringPlanMonths !== undefined
		) {
			const out: Partial<
				Pick<
					CreateRouteInput,
					"recurringPlanStartDate" | "recurring_plan_start" | "recurringPlanMonths"
				>
			> = {};
			if (data.recurringPlanStartDate !== undefined) {
				out.recurringPlanStartDate = data.recurringPlanStartDate;
			}
			if (data.recurring_plan_start !== undefined) {
				out.recurring_plan_start = data.recurring_plan_start;
			}
			if (data.recurringPlanMonths !== undefined) {
				out.recurringPlanMonths = data.recurringPlanMonths;
			}
			return out;
		}
		if (existing.recurring_plan_start && existing.recurring_plan_end) {
			return {
				recurringPlanStartDate: this.formatDateOnlyYmd(
					existing.recurring_plan_start,
				),
				recurringPlanMonths: this.inferRecurringMonthsFromWindow(
					existing.recurring_plan_start,
					existing.recurring_plan_end,
				),
			};
		}
		if (existing.recurring_plan_start) {
			return {
				recurringPlanStartDate: this.formatDateOnlyYmd(
					existing.recurring_plan_start,
				),
				recurringPlanMonths: 1,
			};
		}
		return {};
	}

	async list(params: RouteListQuery) {
		const where = buildWhereCondition(
			{
				page: params.page,
				limit: params.limit,
				search: params.search,
			} as RouteListQuery,
			["office_address", "company.name", "driver.name"],
			[],
		);
		if (params.companyId !== undefined) where.company_id = params.companyId;
		if (params.driverId !== undefined) where.driver_id = params.driverId;
		if (params.status !== undefined) {
			where.segments = {
				some: {
					status: params.status,
				},
			};
		}
		// Hide legacy execution-only rows (old clones: recurring null + plan set).
		const legacyListable: Prisma.RouteWhereInput = {
			OR: [
				{ recurring_plan_start: { not: null } },
				{ route_daily_plan_id: null },
			],
		};
		if (where.OR !== undefined) {
			const searchOr = where.OR;
			delete where.OR;
			where.AND = [
				{ OR: searchOr as Prisma.Enumerable<Prisma.RouteWhereInput> },
				legacyListable,
			];
		} else {
			Object.assign(where, legacyListable);
		}

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
					include: {
						legs: {
							include: {
								passenger: { select: { id: true, name: true } },
							},
						},
					},
				},
				segments: {
					orderBy: { segment_order: "asc" },
					include: { batch: true },
				},
				legs: { include: { passenger: { select: { id: true, name: true } } } },
			},
		});
		if (!route)
			throw ResponseHandler.notFound("No route found against this id: " + id);
		return route;
	}

	async create(data: CreateRouteInput & { legs?: RouteBatchInput["legs"] }) {
		const batchInputs = this.normalizeCreateBatches(data);
		await this.assertDriverApproved(data.driverId);

		const recurringPlan = this.computeRecurringPlanForCreate(data);

		const route = await this.db.$transaction(async (tx) => {
			const created = await tx.route.create({
				data: {
					company_id: data.companyId,
					driver_id: data.driverId,
					office_address: data.officeAddress.trim(),
					office_lat: data.officeLat,
					office_long: data.officeLong,
					route_price: data.route_price ?? null,
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
		await this.applyComputedPickupTimesForRoute(route.id);
		return this.getById(route.id);
	}

	private static readonly ROUTE_PUT_SCHEMA_KEYS = new Set([
		"companyId",
		"driverId",
		"officeAddress",
		"officeLat",
		"officeLong",
		"route_price",
		"batches",
		"legs",
		"recurringPlanStartDate",
		"recurring_plan_start",
		"recurringPlanMonths",
	]);

	/** Strip nested GET-route payload; accept snake_case aliases from clients. */
	private normalizePutKeyAliases(raw: Record<string, unknown>): Record<string, unknown> {
		const o = { ...raw };
		if (o.driverId === undefined && o.driver_id !== undefined) o.driverId = o.driver_id;
		if (o.companyId === undefined && o.company_id !== undefined) {
			o.companyId = o.company_id;
		}
		if (o.officeAddress === undefined && o.office_address !== undefined) {
			o.officeAddress = o.office_address;
		}
		if (o.officeLat === undefined && o.office_lat !== undefined) o.officeLat = o.office_lat;
		if (o.officeLong === undefined && o.office_long !== undefined) {
			o.officeLong = o.office_long;
		}
		if (o.route_price === undefined && o.routePrice !== undefined) {
			o.route_price = o.routePrice;
		}
		return o;
	}

	/** Strip nested GET-route payload keys (company, driver, segments, …). */
	private sanitizeRoutePutBody(raw: UpdateRouteInput): UpdateRouteInput {
		const src = this.normalizePutKeyAliases(raw as Record<string, unknown>);
		const out: Record<string, unknown> = {};
		for (const key of RouteService.ROUTE_PUT_SCHEMA_KEYS) {
			if (src[key] === undefined) continue;
			if (
				(key === "batches" || key === "legs") &&
				Array.isArray(src[key]) &&
				(src[key] as unknown[]).length === 0
			) {
				continue;
			}
			out[key] = src[key];
		}
		return out as UpdateRouteInput;
	}

	private numClose(a: number, b: number): boolean {
		return Math.abs(a - b) < 1e-5;
	}

	/** True when office/company/legs/batches actually change — otherwise same-route meta patch. */
	private hasStructuralRoutePutChange(
		existing: NonNullable<Awaited<ReturnType<RouteService["getById"]>>>,
		data: UpdateRouteInput,
	): boolean {
		if (data.batches !== undefined && data.batches.length > 0) return true;
		const legs = (data as { legs?: unknown[] }).legs;
		if (legs !== undefined && Array.isArray(legs) && legs.length > 0) return true;

		if (
			data.companyId !== undefined &&
			data.companyId !== existing.company_id
		) {
			return true;
		}

		if (
			data.officeAddress !== undefined &&
			data.officeAddress.trim() !== existing.office_address.trim()
		) {
			return true;
		}
		if (
			data.officeLat !== undefined &&
			!this.numClose(data.officeLat, existing.office_lat)
		) {
			return true;
		}
		if (
			data.officeLong !== undefined &&
			!this.numClose(data.officeLong, existing.office_long)
		) {
			return true;
		}

		return false;
	}

	/** Same-route update: driver, price, recurring only. */
	private async updateRouteMetaInPlace(
		id: number,
		data: UpdateRouteInput,
	): Promise<{
		previous_route_id: number;
		route: NonNullable<Awaited<ReturnType<RouteService["getById"]>>>;
		update_mode: "in_place";
	}> {
		await this.getById(id);

		if (data.driverId !== undefined) {
			await this.assertDriverApproved(data.driverId);
		}

		await this.db.route.update({
			where: { id },
			data: {
				...(data.driverId !== undefined && { driver_id: data.driverId }),
				...(data.route_price !== undefined && { route_price: data.route_price }),
			},
		});

		if (
			data.recurring_plan_start !== undefined ||
			data.recurringPlanStartDate !== undefined ||
			data.recurringPlanMonths !== undefined
		) {
			const r = await this.db.route.findUnique({ where: { id } });
			if (!r) throw ResponseHandler.notFound("Route not found");
			const months = data.recurringPlanMonths ?? 1;
			if (months <= 0) {
				await this.db.route.update({
					where: { id },
					data: {
						recurring_plan_start: null,
						recurring_plan_end: null,
					},
				});
			} else {
				const startInput =
					data.recurring_plan_start ?? data.recurringPlanStartDate;
				const start = startInput
					? parseLocalYmd(startInput)
					: (r.recurring_plan_start ?? getTomorrowLocalDateOnly());
				const end = computeInclusivePlanEnd(start, months);
				await this.db.route.update({
					where: { id },
					data: {
						recurring_plan_start: start,
						recurring_plan_end: end,
					},
				});
			}
		}

		const route = await this.getById(id);
		return {
			previous_route_id: id,
			route,
			update_mode: "in_place",
		};
	}

	async update(id: number, rawBody: UpdateRouteInput) {
		const data = this.sanitizeRoutePutBody(rawBody);
		const existing = await this.getById(id);

		if (!this.hasStructuralRoutePutChange(existing, data)) {
			return this.updateRouteMetaInPlace(id, data);
		}

		const dataLegs = (data as { legs?: RouteBatchInput["legs"] }).legs;
		const batches =
			data.batches !== undefined && data.batches.length > 0
				? data.batches
				: dataLegs && dataLegs.length > 0
					? [{ legs: dataLegs }]
					: this.existingRouteToBatches(existing);

		const routePrice = data.route_price ?? existing.route_price;
		if (routePrice == null || !Number.isFinite(Number(routePrice))) {
			throw ResponseHandler.badRequest(
				"route_price is required for the new route (set in body or ensure the source route has route_price)",
			);
		}

		const merged: CreateRouteInput = {
			companyId: data.companyId ?? existing.company_id,
			driverId: data.driverId ?? existing.driver_id,
			officeAddress: (data.officeAddress ?? existing.office_address).trim(),
			officeLat: data.officeLat ?? existing.office_lat,
			officeLong: data.officeLong ?? existing.office_long,
			route_price: Number(routePrice),
			batches,
			...this.mergeRecurringForkPayload(existing, data),
		};

		const created = await this.create(merged);
		return {
			previous_route_id: id,
			route: created,
			update_mode: "forked" as const,
		};
	}

	async optimizeById(id: number) {
		await this.getById(id);
		await this.optimizeAllBatches(id);
		return this.getById(id);
	}

	/**
	 * Create `RouteDailyPlan` for one calendar day and set `routes.route_daily_plan_id`
	 * on the template route (no second `routes` row; legs/batches stay on that route).
	 */
	async createDailyPlanWithExecution(definitionRouteId: number, day: Date) {
		const dayStart = new Date(day);
		// dayStart.setHours(0, 0, 0, 0);
		const dayEnd = new Date(dayStart);
		dayEnd.setDate(dayEnd.getDate() + 1);

		const definition = await this.db.route.findUnique({
			where: { id: definitionRouteId },
			include: {
				company: { select: { weekly_off_days: true } },
				driver: { select: { status: true } },
				batches: {
					orderBy: { batch_order: "asc" },
					include: { legs: { orderBy: { sequence: "asc" } } },
				},
			},
		});
		if (!definition)
			throw ResponseHandler.notFound("Route definition", definitionRouteId);
		if (definition.driver.status !== "APPROVED") {
			throw ResponseHandler.badRequest(
				"Driver is pending — daily plan not created",
			);
		}

		if (definition.recurring_plan_start) {
			const dayT = getLocalDateOnly(dayStart).getTime();
			const startT = getLocalDateOnly(
				definition.recurring_plan_start,
			).getTime();
			if (dayT < startT) {
				throw ResponseHandler.badRequest(
					"Date is before this route's recurring_plan_start",
				);
			}
		}

		const dup = await this.db.routeDailyPlan.findFirst({
			where: {
				definition_route_id: definitionRouteId,
				scheduled_date: { gte: dayStart, lt: dayEnd },
			},
		});
		if (dup) {
			throw ResponseHandler.badRequest(
				"A daily plan already exists for this definition on this date",
			);
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
			throw ResponseHandler.badRequest(
				"Company holiday on this date — plan not created",
			);
		}

		const weekday = this.getWeekdayEnum(dayStart);
		if (definition.company.weekly_off_days.includes(weekday)) {
			throw ResponseHandler.badRequest(
				`Company weekly off (${weekday}) — plan not created`,
			);
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
			throw ResponseHandler.badRequest(
				"Driver on leave this date — plan not created",
			);
		}

		const { routeId: templateRouteId, planId } = await this.db.$transaction(
			async (tx) => {
				const plan = await tx.routeDailyPlan.create({
					data: {
						definition_route_id: definitionRouteId,
						scheduled_date: dayStart,
						status: "PENDING",
					},
				});

				await tx.route.update({
					where: { id: definitionRouteId },
					data: { route_daily_plan_id: plan.id },
				});

				// Freeze who was assigned for this daily plan (pickup + drop),
				// so later admin updates to `routes.driver_id` won't rewrite reports.
				await tx.routeDailyPlanPhaseDriver.createMany({
					data: [
						{
							route_daily_plan_id: plan.id,
							phase: "PICKUP",
							driver_id: definition.driver_id,
							scheduled_date: dayStart,
							status: "PENDING",
						},
						{
							route_daily_plan_id: plan.id,
							phase: "DROP",
							driver_id: definition.driver_id,
							scheduled_date: dayStart,
							status: "PENDING",
						},
					],
				});

				const phaseDrivers = await tx.routeDailyPlanPhaseDriver.findMany({
					where: { route_daily_plan_id: plan.id },
				});
				const pickupPhaseDriver = phaseDrivers.find(
					(x) => x.phase === "PICKUP",
				);
				const dropPhaseDriver = phaseDrivers.find((x) => x.phase === "DROP");
				if (!pickupPhaseDriver || !dropPhaseDriver) {
					throw ResponseHandler.internal(
						"Missing PICKUP/DROP phase driver rows after create",
					);
				}

				const passengerIds = [
					...new Set(
						definition.batches.flatMap((b) =>
							b.legs.map((leg) => leg.passenger_id),
						),
					),
				];
				if (passengerIds.length > 0) {
					await tx.routeDailyPlanPhasePassenger.createMany({
						data: passengerIds.flatMap((passenger_id) => [
							{
								route_daily_plan_phase_driver_id: pickupPhaseDriver.id,
								passenger_id,
								status: "PENDING" as const,
							},
							{
								route_daily_plan_phase_driver_id: dropPhaseDriver.id,
								passenger_id,
								status: "PENDING" as const,
							},
						]),
					});
				}

				await tx.routeDailyPlanPhasePassenger.updateMany({
					where: {
						OR: [
							{
								route_daily_plan_phase_driver_id: pickupPhaseDriver.id,
							},
							{
								route_daily_plan_phase_driver_id: dropPhaseDriver.id,
							},
						],
					},
					data: {
						status: "PENDING",
						driver_arrived_at: null,
						passenger_ack: null,
						picked_at: null,
						dropoff_arrived_at: null,
						dropped_at: null,
					},
				});

				await tx.routeSegment.updateMany({
					where: { route_id: definitionRouteId },
					data: { status: "PENDING" },
				});

				return { routeId: definitionRouteId, planId: plan.id };
			},
		);

		await this.optimizeAllBatches(templateRouteId);
		// Ensure pickup_time / office_pick_up_time are computed before phase trip times.
		await this.applyComputedPickupTimesForRoute(templateRouteId);
		await this.setTripStartTimesForDailyPlan(templateRouteId, planId);
		return this.getById(templateRouteId);
	}

	/** @deprecated alias */
	async cloneTemplateToInstance(definitionRouteId: number, day: Date) {
		return this.createDailyPlanWithExecution(definitionRouteId, day);
	}

	/**
	 * For each eligible template route, create daily plan + link `route_daily_plan_id` unless duplicate / holiday / leave.
	 * @param plannedOnly - cron: routes with `recurring_plan_start` on or before `forDay` (recurring has begun).
	 *   Creates a `RouteDailyPlan` with `scheduled_date = forDay` (e.g. today). `recurring_plan_end` is not used for eligibility.
	 */
	async generateDailyInstancesForDate(
		forDay: Date = new Date(),
		options?: { plannedOnly?: boolean },
	) {
		const dayStart = new Date(forDay);
		// dayStart.setHours(0, 0, 0, 0);

		const where: Prisma.RouteWhereInput = {};

		if (options?.plannedOnly) {
			// Every calendar day from start onward gets a plan for `forDay` — not only the start day.
			where.recurring_plan_start = { lte: dayStart };
		} else {
			where.OR = [
				{ recurring_plan_start: { not: null } },
				{ route_daily_plan_id: null },
			];
		}

		const definitions = await this.db.route.findMany({ where });

		const created: number[] = [];
		const skipped: { definitionRouteId: number; reason: string }[] = [];

		for (const d of definitions) {
			try {
				const route = await this.createDailyPlanWithExecution(d.id, dayStart);
				created.push(route.id);
			} catch (e: unknown) {
				const err = e as { message?: string };
				skipped.push({
					definitionRouteId: d.id,
					reason: err?.message ?? "unknown error",
				});
			}
		}

		return { created, skipped };
	}

	/**
	 * Dry-run for cron/manual daily generation. Reports eligibility and exact skip reasons
	 * without creating any RouteDailyPlan rows.
	 */
	async previewDailyGeneration(
		forDay: Date = new Date(),
		options?: { plannedOnly?: boolean },
	) {
		const dayStart = new Date(forDay);
		dayStart.setHours(0, 0, 0, 0);
		const dayEnd = new Date(dayStart);
		dayEnd.setDate(dayEnd.getDate() + 1);

		const where: Prisma.RouteWhereInput = {};
		if (options?.plannedOnly) {
			where.recurring_plan_start = { lte: dayStart };
		} else {
			where.OR = [
				{ recurring_plan_start: { not: null } },
				{ route_daily_plan_id: null },
			];
		}

		const definitions = await this.db.route.findMany({
			where,
			select: {
				id: true,
				company_id: true,
				driver_id: true,
				recurring_plan_start: true,
				recurring_plan_end: true,
				company: { select: { weekly_off_days: true } },
			},
		});

		const preview: Array<{
			definition_route_id: number;
			company_id: number;
			driver_id: number;
			recurring_plan_start: Date | null;
			recurring_plan_end: Date | null;
			decision:
				| "CAN_CREATE"
				| "SKIP_BEFORE_START"
				| "SKIP_DUPLICATE"
				| "SKIP_HOLIDAY"
				| "SKIP_WEEKLY_OFF"
				| "SKIP_DRIVER_LEAVE";
			reason: string;
		}> = [];

		for (const d of definitions) {
			if (
				d.recurring_plan_start &&
				new Date(dayStart).getTime() <
					new Date(d.recurring_plan_start).setHours(0, 0, 0, 0)
			) {
				preview.push({
					definition_route_id: d.id,
					company_id: d.company_id,
					driver_id: d.driver_id,
					recurring_plan_start: d.recurring_plan_start,
					recurring_plan_end: d.recurring_plan_end,
					decision: "SKIP_BEFORE_START",
					reason: "Date is before recurring_plan_start",
				});
				continue;
			}

			const dup = await this.db.routeDailyPlan.findFirst({
				where: {
					definition_route_id: d.id,
					scheduled_date: { gte: dayStart, lt: dayEnd },
				},
				select: { id: true },
			});
			if (dup) {
				preview.push({
					definition_route_id: d.id,
					company_id: d.company_id,
					driver_id: d.driver_id,
					recurring_plan_start: d.recurring_plan_start,
					recurring_plan_end: d.recurring_plan_end,
					decision: "SKIP_DUPLICATE",
					reason: "A daily plan already exists for this date",
				});
				continue;
			}

			const hol = await this.db.companyHoliday.findUnique({
				where: {
					company_id_date: {
						company_id: d.company_id,
						date: dayStart,
					},
				},
				select: { id: true },
			});
			if (hol) {
				preview.push({
					definition_route_id: d.id,
					company_id: d.company_id,
					driver_id: d.driver_id,
					recurring_plan_start: d.recurring_plan_start,
					recurring_plan_end: d.recurring_plan_end,
					decision: "SKIP_HOLIDAY",
					reason: "Company holiday on this date",
				});
				continue;
			}

			const weekday = this.getWeekdayEnum(dayStart);
			if (d.company.weekly_off_days.includes(weekday)) {
				preview.push({
					definition_route_id: d.id,
					company_id: d.company_id,
					driver_id: d.driver_id,
					recurring_plan_start: d.recurring_plan_start,
					recurring_plan_end: d.recurring_plan_end,
					decision: "SKIP_WEEKLY_OFF",
					reason: `Company weekly off (${weekday})`,
				});
				continue;
			}

			const leave = await this.db.driverLeave.findUnique({
				where: {
					driver_id_date: {
						driver_id: d.driver_id,
						date: dayStart,
					},
				},
				select: { id: true },
			});
			if (leave) {
				preview.push({
					definition_route_id: d.id,
					company_id: d.company_id,
					driver_id: d.driver_id,
					recurring_plan_start: d.recurring_plan_start,
					recurring_plan_end: d.recurring_plan_end,
					decision: "SKIP_DRIVER_LEAVE",
					reason: "Driver is on leave on this date",
				});
				continue;
			}

			preview.push({
				definition_route_id: d.id,
				company_id: d.company_id,
				driver_id: d.driver_id,
				recurring_plan_start: d.recurring_plan_start,
				recurring_plan_end: d.recurring_plan_end,
				decision: "CAN_CREATE",
				reason: "Eligible for daily plan creation",
			});
		}

		return {
			date: dayStart,
			plannedOnly: options?.plannedOnly === true,
			total_definitions: definitions.length,
			summary: {
				can_create: preview.filter((x) => x.decision === "CAN_CREATE").length,
				skip_before_start: preview.filter(
					(x) => x.decision === "SKIP_BEFORE_START",
				).length,
				skip_duplicate: preview.filter((x) => x.decision === "SKIP_DUPLICATE")
					.length,
				skip_holiday: preview.filter((x) => x.decision === "SKIP_HOLIDAY")
					.length,
				skip_weekly_off: preview.filter((x) => x.decision === "SKIP_WEEKLY_OFF")
					.length,
				skip_driver_leave: preview.filter(
					(x) => x.decision === "SKIP_DRIVER_LEAVE",
				).length,
			},
			items: preview,
		};
	}

	/** Per-day passenger counts from RouteDailyPlan + route legs (same template row as `execution_route`). */
	async getTemplatePlanStats(definitionRouteId: number, from: Date, to: Date) {
		const def = await this.db.route.findUnique({
			where: { id: definitionRouteId },
		});
		if (!def)
			throw ResponseHandler.notFound("Route definition", definitionRouteId);

		const fromDay = getLocalDateOnly(from);
		const toDay = getLocalDateOnly(to);

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

	async delete(id: number) {
		await this.getById(id);
		await this.db.route.delete({ where: { id } });
	}
}

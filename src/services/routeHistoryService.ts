import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import { getLocalDateOnly, parseLocalYmd } from "../utils/recurringPlan";
import { getLocalDayRange } from "../utils/routeDayScope";
import type { PhasePassengerStatus } from "../generated/prisma/client";

const db = DatabaseService.getInstance().getPrisma();

export type RouteHistoryQuery = {
	date?: string;
	companyId?: number;
	driverId?: number;
};

/** Parse YYYY-MM-DD as UTC calendar date (matches `scheduled_date` @db.Date storage). */
function parseReportDate(dateStr?: string): Date {
	if (!dateStr?.trim()) return getLocalDateOnly(new Date());
	const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) throw ResponseHandler.badRequest("date must be YYYY-MM-DD");
	return parseLocalYmd(dateStr.trim());
}

function formatDateOnly(d: Date): string {
	const x = getLocalDateOnly(d);
	const y = x.getUTCFullYear();
	const mo = String(x.getUTCMonth() + 1).padStart(2, "0");
	const day = String(x.getUTCDate()).padStart(2, "0");
	return `${y}-${mo}-${day}`;
}

function toIso(d: Date | null | undefined): string | null {
	return d != null ? d.toISOString() : null;
}

function isPickedUp(snap: PhasePassengerSnapshot | null): boolean {
	if (!snap) return false;
	if (snap.status === "SKIPPED" || snap.status === "MOVE_TO_NEXT") return false;
	if (snap.passenger_ack === "NOT_COMING") return false;
	return snap.status === "PICKED" || snap.picked_at != null;
}

function isDroppedOff(snap: PhasePassengerSnapshot | null): boolean {
	if (!snap) return false;
	return snap.status === "DROPPED";
}

/** Evening office pick-up: manual routes prefer `passengers.office_pick_up_time`. */
function resolveDropOfficePickUpTime(
	waypointMode: "auto" | "manual",
	passengerOfficePickUp: string | null,
	legOfficePickUp: string | null,
): string | null {
	const fromPassenger = passengerOfficePickUp?.trim() || null;
	const fromLeg = legOfficePickUp?.trim() || null;
	if (waypointMode === "manual") {
		return fromPassenger ?? fromLeg;
	}
	return fromLeg ?? fromPassenger;
}

type PhasePassengerSnapshot = {
	phase_passenger_id: number;
	status: PhasePassengerStatus;
	driver_arrived_at: Date | null;
	passenger_ack: string | null;
	picked_at: Date | null;
	dropoff_arrived_at: Date | null;
	dropped_at: Date | null;
};

type PassengerSlot = {
	passenger_id: number;
	name: string;
	phone_no: string | null;
	office_pick_up_time: string | null;
	pickup: PhasePassengerSnapshot | null;
	drop: PhasePassengerSnapshot | null;
};

export class RouteHistoryService {
	async getDailyRouteHistoryReport(query: RouteHistoryQuery) {
		const forDay = parseReportDate(query.date);
		const { start, end } = getLocalDayRange(forDay);
		const dateLabel = formatDateOnly(forDay);

		const plans = await db.routeDailyPlan.findMany({
			where: {
				scheduled_date: { gte: start, lt: end },
				...(query.companyId != null
					? { definition_route: { company_id: query.companyId } }
					: {}),
				...(query.driverId != null
					? { phase_drivers: { some: { driver_id: query.driverId } } }
					: {}),
			},
			include: {
				definition_route: {
					select: {
						id: true,
						waypointMode: true,
						office_address: true,
						route_price: true,
						company: { select: { id: true, name: true } },
						driver: {
							select: { id: true, name: true, phone_no: true },
						},
					},
				},
				execution_route: { select: { id: true } },
				phase_drivers: {
					include: {
						driver: {
							select: { id: true, name: true, phone_no: true },
						},
						route_daily_plan_phase_passengers: {
							include: {
								passenger: {
									select: {
										id: true,
										name: true,
										phone_no: true,
										office_pick_up_time: true,
									},
								},
							},
						},
					},
				},
			},
			orderBy: [{ scheduled_date: "asc" }, { id: "asc" }],
		});

		const execRouteIds = [
			...new Set(
				plans
					.map((p) => p.execution_route?.id)
					.filter((id): id is number => id != null),
			),
		];
		const routeLegs =
			execRouteIds.length === 0
				? []
				: await db.routeLeg.findMany({
						where: { route_id: { in: execRouteIds } },
						select: {
							route_id: true,
							passenger_id: true,
							pickup_time: true,
							office_pick_up_time: true,
						},
					});
		const legPickupTimeByRoutePassenger = new Map<string, string>();
		const legOfficePickUpTimeByRoutePassenger = new Map<string, string>();
		for (const leg of routeLegs) {
			const key = `${leg.route_id}:${leg.passenger_id}`;
			legPickupTimeByRoutePassenger.set(key, leg.pickup_time);
			if (leg.office_pick_up_time?.trim()) {
				legOfficePickUpTimeByRoutePassenger.set(
					key,
					leg.office_pick_up_time.trim(),
				);
			}
		}

		const routes = plans.map((plan) => {
			const executionRouteId = plan.execution_route?.id ?? null;
			const waypointMode =
				plan.definition_route.waypointMode === "manual" ? "manual" : "auto";
			const pickupPd = plan.phase_drivers.find((pd) => pd.phase === "PICKUP");
			const dropPd = plan.phase_drivers.find((pd) => pd.phase === "DROP");
			const driver = pickupPd?.driver ?? dropPd?.driver ?? plan.definition_route.driver;

			const byPassenger = new Map<number, PassengerSlot>();

			const ingestPhase = (
				pd: (typeof plan.phase_drivers)[number] | undefined,
				phase: "PICKUP" | "DROP",
			) => {
				if (!pd) return;
				for (const pp of pd.route_daily_plan_phase_passengers) {
					const slot = byPassenger.get(pp.passenger_id) ?? {
						passenger_id: pp.passenger_id,
						name: pp.passenger.name,
						phone_no: pp.passenger.phone_no,
						office_pick_up_time: pp.passenger.office_pick_up_time,
						pickup: null,
						drop: null,
					};
					const snap: PhasePassengerSnapshot = {
						phase_passenger_id: pp.id,
						status: pp.status,
						driver_arrived_at: pp.driver_arrived_at,
						passenger_ack: pp.passenger_ack,
						picked_at: pp.picked_at,
						dropoff_arrived_at: pp.dropoff_arrived_at,
						dropped_at: pp.dropped_at,
					};
					if (phase === "PICKUP") slot.pickup = snap;
					else slot.drop = snap;
					byPassenger.set(pp.passenger_id, slot);
				}
			};

			ingestPhase(pickupPd, "PICKUP");
			ingestPhase(dropPd, "DROP");

			const passengers = [...byPassenger.values()].map((p) => {
				const picked_up = isPickedUp(p.pickup);
				const dropped_off = isDroppedOff(p.drop);

				const legKey =
					executionRouteId != null
						? `${executionRouteId}:${p.passenger_id}`
						: null;
				const legPickupTime =
					legKey != null
						? (legPickupTimeByRoutePassenger.get(legKey) ?? null)
						: null;
				const legOfficePickUpTime =
					legKey != null
						? (legOfficePickUpTimeByRoutePassenger.get(legKey) ?? null)
						: null;
				const dropOfficePickUpTime = resolveDropOfficePickUpTime(
					waypointMode,
					p.office_pick_up_time,
					legOfficePickUpTime,
				);

				return {
					passenger_id: p.passenger_id,
					name: p.name,
					phone_no: p.phone_no,
					pickup: p.pickup
						? {
								phase_passenger_id: p.pickup.phase_passenger_id,
								status: p.pickup.status,
								picked_up,
								actual_pickup_time: legPickupTime,
								driver_arrived_at: toIso(p.pickup.driver_arrived_at),
								passenger_ack: p.pickup.passenger_ack,
								picked_at: toIso(p.pickup.picked_at),
								dropped_at: toIso(p.pickup.dropped_at),
							}
						: null,
					drop: p.drop
						? {
								phase_passenger_id: p.drop.phase_passenger_id,
								status: p.drop.status,
								dropped_off,
								actual_pickup_time: dropOfficePickUpTime,
								driver_arrived_at: toIso(p.drop.driver_arrived_at),
								passenger_ack: p.drop.passenger_ack,
								picked_at: toIso(p.drop.picked_at),
								dropoff_arrived_at: toIso(
									p.drop.dropoff_arrived_at ?? p.drop.driver_arrived_at,
								),
								dropped_at: toIso(p.drop.dropped_at),
							}
						: null,
					summary: {
						picked_up,
						not_picked_up: !picked_up,
						dropped_off,
						not_dropped_off: picked_up && !dropped_off,
					},
				};
			});

			const pickupSummary = {
				total: passengers.length,
				picked: passengers.filter((p) => p.summary.picked_up).length,
				not_picked: passengers.filter((p) => p.summary.not_picked_up).length,
			};
			const dropSummary = {
				total: passengers.length,
				dropped: passengers.filter((p) => p.summary.dropped_off).length,
				not_dropped: passengers.filter((p) => p.summary.not_dropped_off).length,
				pending_drop: passengers.filter(
					(p) => p.summary.picked_up && !p.summary.dropped_off,
				).length,
			};

			const tripStarted =
				plan.started_at ??
				pickupPd?.trip_started_at ??
				dropPd?.trip_started_at ??
				null;

			return {
				plan_id: plan.id,
				scheduled_date: formatDateOnly(plan.scheduled_date),
				plan_status: plan.status,
				trip_started: tripStarted != null,
				started_at: tripStarted,
				trip_completed: plan.status === "COMPLETED",
				completed_at: plan.completed_at,
				definition_route_id: plan.definition_route_id,
				waypoint_mode: waypointMode,
				execution_route_id: plan.execution_route?.id ?? null,
				office_address: plan.definition_route.office_address,
				route_price: plan.definition_route.route_price,
				company: plan.definition_route.company,
				driver: driver
					? { id: driver.id, name: driver.name, phone_no: driver.phone_no }
					: null,
				pickup_phase: pickupPd
					? {
							phase_driver_id: pickupPd.id,
							status: pickupPd.status,
							trip_started_at: pickupPd.trip_started_at,
						}
					: null,
				drop_phase: dropPd
					? {
							phase_driver_id: dropPd.id,
							status: dropPd.status,
							trip_started_at: dropPd.trip_started_at,
						}
					: null,
				passenger_summary: {
					pickup: pickupSummary,
					drop: dropSummary,
				},
				passengers,
			};
		});

		const summary = {
			total_routes: routes.length,
			pending: routes.filter((r) => r.plan_status === "PENDING").length,
			ongoing: routes.filter((r) => r.plan_status === "ONGOING").length,
			completed: routes.filter((r) => r.plan_status === "COMPLETED").length,
			started: routes.filter((r) => r.trip_started).length,
			total_passengers: routes.reduce(
				(sum, r) => sum + r.passenger_summary.pickup.total,
				0,
			),
			passengers_picked: routes.reduce(
				(sum, r) => sum + r.passenger_summary.pickup.picked,
				0,
			),
			passengers_not_picked: routes.reduce(
				(sum, r) => sum + r.passenger_summary.pickup.not_picked,
				0,
			),
			passengers_dropped: routes.reduce(
				(sum, r) => sum + r.passenger_summary.drop.dropped,
				0,
			),
			passengers_not_dropped: routes.reduce(
				(sum, r) => sum + r.passenger_summary.drop.not_dropped,
				0,
			),
		};

		return {
			date: dateLabel,
			filters: {
				company_id: query.companyId ?? null,
				driver_id: query.driverId ?? null,
			},
			summary,
			routes,
		};
	}
}

export const routeHistoryService = new RouteHistoryService();

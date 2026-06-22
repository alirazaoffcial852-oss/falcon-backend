import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import { getLocalDateOnly, parseLocalYmd } from "../utils/recurringPlan";
import { getLocalDayRange } from "../utils/routeDayScope";
import {
	buildPassengerReportBundle,
	indexRouteLegTimes,
} from "./routePassengerReport";

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
										home_address: true,
										home_lat: true,
										home_long: true,
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
		const {
			legPickupTimeByRoutePassenger,
			legOfficePickUpTimeByRoutePassenger,
		} = indexRouteLegTimes(routeLegs);

		const routes = plans.map((plan) => {
			const executionRouteId = plan.execution_route?.id ?? null;
			const waypointMode =
				plan.definition_route.waypointMode === "manual" ? "manual" : "auto";
			const pickupPd = plan.phase_drivers.find((pd) => pd.phase === "PICKUP");
			const dropPd = plan.phase_drivers.find((pd) => pd.phase === "DROP");
			const driver = pickupPd?.driver ?? dropPd?.driver ?? plan.definition_route.driver;

			const { passengers, passenger_summary } = buildPassengerReportBundle({
				phaseDrivers: plan.phase_drivers,
				executionRouteId,
				waypointMode,
				legPickupTimeByRoutePassenger,
				legOfficePickUpTimeByRoutePassenger,
			});

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
							driver: pickupPd.driver
								? {
										id: pickupPd.driver.id,
										name: pickupPd.driver.name,
										phone_no: pickupPd.driver.phone_no,
									}
								: null,
						}
					: null,
				drop_phase: dropPd
					? {
							phase_driver_id: dropPd.id,
							status: dropPd.status,
							trip_started_at: dropPd.trip_started_at,
							driver: dropPd.driver
								? {
										id: dropPd.driver.id,
										name: dropPd.driver.name,
										phone_no: dropPd.driver.phone_no,
									}
								: null,
						}
					: null,
				passenger_summary,
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

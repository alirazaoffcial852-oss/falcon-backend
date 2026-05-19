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

function isPickedUp(status: PhasePassengerStatus): boolean {
	return status === "PICKED";
}

function isDropped(status: PhasePassengerStatus): boolean {
	return status === "DROPPED";
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
									select: { id: true, name: true, phone_no: true },
								},
							},
						},
					},
				},
			},
			orderBy: [{ scheduled_date: "asc" }, { id: "asc" }],
		});

		const routes = plans.map((plan) => {
			const pickupPd = plan.phase_drivers.find((pd) => pd.phase === "PICKUP");
			const dropPd = plan.phase_drivers.find((pd) => pd.phase === "DROP");
			const driver = pickupPd?.driver ?? dropPd?.driver ?? plan.definition_route.driver;

			const byPassenger = new Map<
				number,
				{
					passenger_id: number;
					name: string;
					phone_no: string | null;
					pickup: PhasePassengerSnapshot | null;
					drop: PhasePassengerSnapshot | null;
				}
			>();

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
				const pickupStatus = p.pickup?.status ?? "PENDING";
				const dropStatus = p.drop?.status ?? "PENDING";
				const picked_up = isPickedUp(pickupStatus);
				const dropped_off = isDropped(dropStatus);

				return {
					passenger_id: p.passenger_id,
					name: p.name,
					phone_no: p.phone_no,
					pickup: p.pickup
						? {
								phase_passenger_id: p.pickup.phase_passenger_id,
								status: p.pickup.status,
								picked_up,
								driver_arrived_at: p.pickup.driver_arrived_at,
								passenger_ack: p.pickup.passenger_ack,
								picked_at: p.pickup.picked_at,
							}
						: null,
					drop: p.drop
						? {
								phase_passenger_id: p.drop.phase_passenger_id,
								status: p.drop.status,
								dropped_off,
								dropoff_arrived_at: p.drop.dropoff_arrived_at,
								dropped_at: p.drop.dropped_at,
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

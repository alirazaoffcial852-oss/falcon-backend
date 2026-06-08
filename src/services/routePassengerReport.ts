import { DatabaseService } from "../config/database";
import type { PhasePassengerStatus } from "../generated/prisma/client";

const db = DatabaseService.getInstance().getPrisma();

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

/** DROP `actual_pickup_time`: auto = `route_legs.office_pick_up_time`; manual = passenger then leg office time. */
function resolveDropActualPickupTime(
	waypointMode: "auto" | "manual",
	passengerOfficePickUp: string | null,
	legOfficePickUp: string | null,
): string | null {
	if (waypointMode === "auto") {
		return legOfficePickUp?.trim() || null;
	}
	const fromPassenger = passengerOfficePickUp?.trim() || null;
	const fromLeg = legOfficePickUp?.trim() || null;
	return fromPassenger ?? fromLeg;
}

export type RouteLegTimeIndex = {
	legPickupTimeByRoutePassenger: Map<string, string>;
	legOfficePickUpTimeByRoutePassenger: Map<string, string>;
};

export function indexRouteLegTimes(
	legs: Array<{
		route_id: number;
		passenger_id: number;
		pickup_time: string;
		office_pick_up_time: string | null;
	}>,
): RouteLegTimeIndex {
	const legPickupTimeByRoutePassenger = new Map<string, string>();
	const legOfficePickUpTimeByRoutePassenger = new Map<string, string>();
	for (const leg of legs) {
		const key = `${leg.route_id}:${leg.passenger_id}`;
		legPickupTimeByRoutePassenger.set(key, leg.pickup_time);
		if (leg.office_pick_up_time?.trim()) {
			legOfficePickUpTimeByRoutePassenger.set(
				key,
				leg.office_pick_up_time.trim(),
			);
		}
	}
	return {
		legPickupTimeByRoutePassenger,
		legOfficePickUpTimeByRoutePassenger,
	};
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

type PhaseDriverWithPassengers = {
	phase: "PICKUP" | "DROP";
	route_daily_plan_phase_passengers: Array<{
		id: number;
		passenger_id: number;
		status: PhasePassengerStatus;
		driver_arrived_at: Date | null;
		passenger_ack: string | null;
		picked_at: Date | null;
		dropoff_arrived_at: Date | null;
		dropped_at: Date | null;
		passenger: {
			id: number;
			name: string;
			phone_no: string | null;
			office_pick_up_time: string | null;
		};
	}>;
};

export type RoutePassengerReportBundle = {
	passengers: Array<{
		passenger_id: number;
		name: string;
		phone_no: string | null;
		pickup: {
			phase_passenger_id: number | null;
			status: PhasePassengerStatus | null;
			picked_up: boolean;
			actual_pickup_time: string | null;
			driver_arrived_at: string | null;
			passenger_ack: string | null;
			picked_at: string | null;
			dropped_at: string | null;
		} | null;
		drop: {
			phase_passenger_id: number | null;
			status: PhasePassengerStatus | null;
			dropped_off: boolean;
			actual_pickup_time: string | null;
			driver_arrived_at: string | null;
			passenger_ack: string | null;
			picked_at: string | null;
			dropoff_arrived_at: string | null;
			dropped_at: string | null;
		} | null;
		summary: {
			picked_up: boolean;
			not_picked_up: boolean;
			dropped_off: boolean;
			not_dropped_off: boolean;
		};
	}>;
	passenger_summary: {
		pickup: { total: number; picked: number; not_picked: number };
		drop: {
			total: number;
			dropped: number;
			not_dropped: number;
			pending_drop: number;
		};
	};
};

type RouteLegPhaseTiming = {
	driver_arrived_at?: string | null;
	picked_at?: string | null;
	dropoff_arrived_at?: string | null;
	dropped_at?: string | null;
};

export type RouteLegForPassengerReport = {
	passenger_id: number;
	pickup_time: string;
	office_pick_up_time: string | null;
	passenger: {
		id: number;
		name: string;
		phone_no?: string | null;
		office_pick_up_time?: string | null;
	};
	pickup_phase?: RouteLegPhaseTiming | null;
	drop_phase?: RouteLegPhaseTiming | null;
};

/** Build `passengers[]` from route legs (templates + leg phase timing when present). */
export function buildPassengerReportFromRouteLegs(
	waypointMode: "auto" | "manual",
	legs: RouteLegForPassengerReport[],
): RoutePassengerReportBundle {
	const byPassenger = new Map<
		number,
		{
			passenger_id: number;
			name: string;
			phone_no: string | null;
			office_pick_up_time: string | null;
			pickup_time: string;
			leg_office_pick_up: string | null;
			pickup_phase: RouteLegPhaseTiming | null;
			drop_phase: RouteLegPhaseTiming | null;
		}
	>();

	for (const leg of legs) {
		const officeFromPassenger = leg.passenger.office_pick_up_time?.trim() || null;
		byPassenger.set(leg.passenger_id, {
			passenger_id: leg.passenger_id,
			name: leg.passenger.name,
			phone_no: leg.passenger.phone_no ?? null,
			office_pick_up_time: officeFromPassenger,
			pickup_time: leg.pickup_time,
			leg_office_pick_up: leg.office_pick_up_time?.trim() || null,
			pickup_phase: leg.pickup_phase ?? null,
			drop_phase: leg.drop_phase ?? null,
		});
	}

	const passengers = [...byPassenger.values()].map((p) => {
		const dropActualTime = resolveDropActualPickupTime(
			waypointMode,
			p.office_pick_up_time,
			p.leg_office_pick_up,
		);
		const picked_up = !!p.pickup_phase?.picked_at;
		const dropped_off = !!p.drop_phase?.dropped_at;

		return {
			passenger_id: p.passenger_id,
			name: p.name,
			phone_no: p.phone_no,
			pickup: {
				phase_passenger_id: null,
				status: null,
				picked_up,
				actual_pickup_time: p.pickup_time,
				driver_arrived_at: p.pickup_phase?.driver_arrived_at ?? null,
				passenger_ack: null,
				picked_at: p.pickup_phase?.picked_at ?? null,
				dropped_at: p.pickup_phase?.dropped_at ?? null,
			},
			drop: {
				phase_passenger_id: null,
				status: null,
				dropped_off,
				actual_pickup_time: dropActualTime,
				driver_arrived_at: p.drop_phase?.driver_arrived_at ?? null,
				passenger_ack: null,
				picked_at: p.drop_phase?.picked_at ?? null,
				dropoff_arrived_at:
					p.drop_phase?.dropoff_arrived_at ??
					p.drop_phase?.driver_arrived_at ??
					null,
				dropped_at: p.drop_phase?.dropped_at ?? null,
			},
			summary: {
				picked_up,
				not_picked_up: !picked_up,
				dropped_off,
				not_dropped_off: picked_up && !dropped_off,
			},
		};
	});

	return {
		passengers,
		passenger_summary: {
			pickup: {
				total: passengers.length,
				picked: passengers.filter((x) => x.summary.picked_up).length,
				not_picked: passengers.filter((x) => x.summary.not_picked_up).length,
			},
			drop: {
				total: passengers.length,
				dropped: passengers.filter((x) => x.summary.dropped_off).length,
				not_dropped: passengers.filter((x) => x.summary.not_dropped_off).length,
				pending_drop: passengers.filter(
					(x) => x.summary.picked_up && !x.summary.dropped_off,
				).length,
			},
		},
	};
}

export function buildPassengerReportBundle(input: {
	phaseDrivers: PhaseDriverWithPassengers[];
	executionRouteId: number | null;
	waypointMode: "auto" | "manual";
	legPickupTimeByRoutePassenger: Map<string, string>;
	legOfficePickUpTimeByRoutePassenger: Map<string, string>;
}): RoutePassengerReportBundle {
	const pickupPd = input.phaseDrivers.find((pd) => pd.phase === "PICKUP");
	const dropPd = input.phaseDrivers.find((pd) => pd.phase === "DROP");
	const byPassenger = new Map<number, PassengerSlot>();

	const ingestPhase = (
		pd: PhaseDriverWithPassengers | undefined,
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
			input.executionRouteId != null
				? `${input.executionRouteId}:${p.passenger_id}`
				: null;
		const legPickupTime =
			legKey != null
				? (input.legPickupTimeByRoutePassenger.get(legKey) ?? null)
				: null;
		const legOfficePickUpTime =
			legKey != null
				? (input.legOfficePickUpTimeByRoutePassenger.get(legKey) ?? null)
				: null;
		const dropActualPickupTime = resolveDropActualPickupTime(
			input.waypointMode,
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
						actual_pickup_time: dropActualPickupTime,
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

	return {
		passengers,
		passenger_summary: {
			pickup: {
				total: passengers.length,
				picked: passengers.filter((p) => p.summary.picked_up).length,
				not_picked: passengers.filter((p) => p.summary.not_picked_up).length,
			},
			drop: {
				total: passengers.length,
				dropped: passengers.filter((p) => p.summary.dropped_off).length,
				not_dropped: passengers.filter((p) => p.summary.not_dropped_off)
					.length,
				pending_drop: passengers.filter(
					(p) => p.summary.picked_up && !p.summary.dropped_off,
				).length,
			},
		},
	};
}

/** Batch-load history-style passenger reports keyed by `route_daily_plan.id`. */
export async function fetchPassengerReportsByPlanIds(
	planIds: number[],
): Promise<Map<number, RoutePassengerReportBundle>> {
	const uniqueIds = [...new Set(planIds.filter((id) => id > 0))];
	const out = new Map<number, RoutePassengerReportBundle>();
	if (uniqueIds.length === 0) return out;

	const plans = await db.routeDailyPlan.findMany({
		where: { id: { in: uniqueIds } },
		include: {
			definition_route: { select: { waypointMode: true } },
			execution_route: { select: { id: true } },
			phase_drivers: {
				include: {
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

	for (const plan of plans) {
		const executionRouteId = plan.execution_route?.id ?? null;
		const waypointMode =
			plan.definition_route.waypointMode === "manual" ? "manual" : "auto";
		out.set(
			plan.id,
			buildPassengerReportBundle({
				phaseDrivers: plan.phase_drivers,
				executionRouteId,
				waypointMode,
				legPickupTimeByRoutePassenger,
				legOfficePickUpTimeByRoutePassenger,
			}),
		);
	}

	return out;
}

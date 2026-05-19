import {
	compareRouteLegsForDriverQueue,
	parseTimeToMinutesFromMidnight,
} from "./pickupSchedule";

export type DirectionsLegJson = {
	distance_meters?: number;
	duration_seconds?: number;
	start_address?: string;
	end_address?: string;
};

export type RouteLegForEstimate = {
	passenger_id: number;
	batch_id: number;
	sequence: number;
	drop_sequence: number;
	pickup_lat: number;
	pickup_long: number;
	pickup_address: string;
	pickup_time: string;
	dropoff_lat: number;
	dropoff_long: number;
	dropoff_address: string;
	dropoff_time: string;
};

export type PhasePassengerEstimate = {
	/** Visit order: 1 = first stop in this phase */
	queue_position: number;
	/** Planned stop time at this passenger (pickup_time or dropoff_time) */
	scheduled_stop_time: string | null;
	/** Drive time from previous point (driver / previous passenger / office) */
	travel_from_previous_seconds: number | null;
	travel_from_previous_minutes: number | null;
	travel_from_previous_label: string | null;
	travel_from_previous_source:
		| "google_directions"
		| "scheduled_time_gap"
		| "driver_location_estimate"
		| null;
	travel_from: "DRIVER" | "PREVIOUS_PASSENGER" | "OFFICE" | null;
	/** Sum of drive segments before this stop (excludes waiting at stops) */
	cumulative_travel_seconds: number;
};

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

/** Parse cached Google Directions legs from route_batches. */
export function parseDirectionsLegDurations(raw: unknown): number[] {
	if (!Array.isArray(raw)) return [];
	return raw.map((x) => {
		const o = x as DirectionsLegJson;
		return Math.max(0, Math.round(Number(o?.duration_seconds ?? 0)));
	});
}

export function formatTravelDurationLabel(
	seconds: number | null | undefined,
): string | null {
	if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
		return null;
	}
	const mins = Math.round(seconds / 60);
	if (mins < 1) return "< 1 min";
	return `${mins} min`;
}

function scheduledGapSeconds(
	prevTime: string | null | undefined,
	curTime: string | null | undefined,
): number | null {
	const prev = parseTimeToMinutesFromMidnight(prevTime);
	const cur = parseTimeToMinutesFromMidnight(curTime);
	if (prev == null || cur == null) return null;
	let diff = cur - prev;
	if (diff < 0) diff += 24 * 60;
	return diff * 60;
}

function estimateDriverToStopSeconds(
	driverLat: number | null,
	driverLong: number | null,
	stopLat: number,
	stopLong: number,
	avgSpeedKmh = 30,
): number | null {
	if (driverLat == null || driverLong == null) return null;
	const km = haversineKm(driverLat, driverLong, stopLat, stopLong);
	if (km <= 0) return 0;
	return Math.round((km / avgSpeedKmh) * 3600);
}

type PhasePassengerRow = {
	id: number;
	passenger_id: number;
	route_daily_plan_phase_driver_id: number;
	status: string;
	driver_arrived_at: Date | null;
	passenger_ack: string | null;
	picked_at: Date | null;
	dropoff_arrived_at: Date | null;
	dropped_at: Date | null;
	created_at: Date;
	updated_at: Date;
	passenger: { id: number; name: string; phone_no: string };
};

type BatchDirections = {
	id: number;
	pickup_directions_legs: unknown;
	drop_directions_legs: unknown;
};

/**
 * Build phase_passengers for GET /session with queue order + travel estimates.
 */
export function buildPhasePassengersWithEstimates(params: {
	phase: "PICKUP" | "DROP";
	phasePassengers: PhasePassengerRow[];
	legByPassengerId: Map<number, RouteLegForEstimate>;
	batches: BatchDirections[];
	driverLocation: { current_lat: number | null; current_long: number | null };
}) {
	const { phase, phasePassengers, legByPassengerId, batches, driverLocation } =
		params;

	const durationsByBatchId = new Map<number, number[]>();
	for (const b of batches) {
		const raw =
			phase === "PICKUP"
				? b.pickup_directions_legs
				: b.drop_directions_legs;
		durationsByBatchId.set(b.id, parseDirectionsLegDurations(raw));
	}

	const ordered = phasePassengers
		.map((pp) => {
			const leg = legByPassengerId.get(pp.passenger_id);
			return { pp, leg };
		})
		.filter((x): x is { pp: PhasePassengerRow; leg: RouteLegForEstimate } =>
			x.leg != null,
		)
		.sort((a, b) => compareRouteLegsForDriverQueue(a.leg, b.leg, phase));

	const missingLeg = phasePassengers.filter(
		(pp) => !legByPassengerId.has(pp.passenger_id),
	);

	let cumulative = 0;

	type EnrichedPhasePassenger = ReturnType<
		typeof mapPhasePassengerWithEstimate
	>;

	const enriched: EnrichedPhasePassenger[] = ordered.map(
		({ pp, leg }, index) => {
			return mapPhasePassengerWithEstimate({
				pp,
				leg,
				index,
				ordered,
				phase,
				dirDurationsByBatchId: durationsByBatchId,
				batches,
				driverLocation,
				getCumulative: () => cumulative,
				addToCumulative: (sec: number) => {
					cumulative += sec;
				},
			});
		},
	);

	for (const pp of missingLeg) {
		const base = {
			id: pp.id,
			route_daily_plan_phase_driver_id: pp.route_daily_plan_phase_driver_id,
			passenger_id: pp.passenger_id,
			status: pp.status,
			driver_arrived_at: pp.driver_arrived_at,
			passenger_ack: pp.passenger_ack,
			picked_at: pp.picked_at,
			dropoff_arrived_at: pp.dropoff_arrived_at,
			dropped_at: pp.dropped_at,
			created_at: pp.created_at,
			updated_at: pp.updated_at,
			lat: null as number | null,
			long: null as number | null,
			queue_position: enriched.length + 1,
			scheduled_stop_time: null,
			travel_from_previous_seconds: null,
			travel_from_previous_minutes: null,
			travel_from_previous_label: null,
			travel_from_previous_source: null,
			travel_from: null,
			cumulative_travel_seconds: cumulative,
			passenger: pp.passenger,
		};
		enriched.push(
			(phase === "PICKUP"
				? {
						...base,
						pickup_address: null,
						pickup_time: null,
					}
				: {
						...base,
						dropoff_address: null,
						dropoff_time: null,
					}) as unknown as EnrichedPhasePassenger,
		);
	}

	return enriched;
}

function mapPhasePassengerWithEstimate(ctx: {
	pp: PhasePassengerRow;
	leg: RouteLegForEstimate;
	index: number;
	ordered: Array<{ pp: PhasePassengerRow; leg: RouteLegForEstimate }>;
	phase: "PICKUP" | "DROP";
	dirDurationsByBatchId: Map<number, number[]>;
	batches: BatchDirections[];
	driverLocation: { current_lat: number | null; current_long: number | null };
	getCumulative: () => number;
	addToCumulative: (sec: number) => void;
}) {
	const {
		pp,
		leg,
		index,
		ordered,
		phase,
		dirDurationsByBatchId,
		batches,
		driverLocation,
		getCumulative,
		addToCumulative,
	} = ctx;

	const queuePosition = index + 1;
	const dirDurations =
		dirDurationsByBatchId.get(leg.batch_id) ??
		dirDurationsByBatchId.get(batches[0]?.id ?? -1) ??
		[];

	const scheduledStopTime =
		phase === "PICKUP"
			? leg.pickup_time?.trim() || null
			: leg.dropoff_time?.trim() || null;

	let travelSeconds: number | null = null;
	let travelSource: PhasePassengerEstimate["travel_from_previous_source"] = null;
	let travelFrom: PhasePassengerEstimate["travel_from"] = null;

	if (phase === "PICKUP") {
		if (index === 0) {
			travelFrom = "DRIVER";
			const est = estimateDriverToStopSeconds(
				driverLocation.current_lat,
				driverLocation.current_long,
				leg.pickup_lat,
				leg.pickup_long,
			);
			if (est != null) {
				travelSeconds = est;
				travelSource = "driver_location_estimate";
			}
		} else {
			travelFrom = "PREVIOUS_PASSENGER";
			const legIdx = index - 1;
			if (legIdx < dirDurations.length && dirDurations[legIdx] > 0) {
				travelSeconds = dirDurations[legIdx];
				travelSource = "google_directions";
			} else {
				const prev = ordered[index - 1]?.leg;
				const gap = scheduledGapSeconds(prev?.pickup_time, leg.pickup_time);
				if (gap != null && gap > 0) {
					travelSeconds = gap;
					travelSource = "scheduled_time_gap";
				}
			}
		}
	} else {
		if (index === 0) {
			travelFrom = "OFFICE";
			if (dirDurations[0] > 0) {
				travelSeconds = dirDurations[0];
				travelSource = "google_directions";
			}
		} else {
			travelFrom = "PREVIOUS_PASSENGER";
			const legIdx = index;
			if (legIdx < dirDurations.length && dirDurations[legIdx] > 0) {
				travelSeconds = dirDurations[legIdx];
				travelSource = "google_directions";
			} else {
				const prev = ordered[index - 1]?.leg;
				const gap = scheduledGapSeconds(prev?.dropoff_time, leg.dropoff_time);
				if (gap != null && gap > 0) {
					travelSeconds = gap;
					travelSource = "scheduled_time_gap";
				}
			}
		}
	}

	if (travelSeconds != null) {
		addToCumulative(travelSeconds);
	}

	const estimate: PhasePassengerEstimate = {
		queue_position: queuePosition,
		scheduled_stop_time: scheduledStopTime,
		travel_from_previous_seconds: travelSeconds,
		travel_from_previous_minutes:
			travelSeconds != null ? Math.round(travelSeconds / 60) : null,
		travel_from_previous_label: formatTravelDurationLabel(travelSeconds),
		travel_from_previous_source: travelSource,
		travel_from: travelFrom,
		cumulative_travel_seconds: getCumulative(),
	};

	const stop =
		phase === "PICKUP"
			? {
					lat: leg.pickup_lat,
					long: leg.pickup_long,
					pickup_address: leg.pickup_address,
					pickup_time: leg.pickup_time,
				}
			: {
					lat: leg.dropoff_lat,
					long: leg.dropoff_long,
					dropoff_address: leg.dropoff_address,
					dropoff_time: leg.dropoff_time,
				};

	return {
		id: pp.id,
		route_daily_plan_phase_driver_id: pp.route_daily_plan_phase_driver_id,
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
		...estimate,
		passenger: pp.passenger,
	};
}

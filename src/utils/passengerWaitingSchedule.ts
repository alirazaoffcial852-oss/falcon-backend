import { addHmsDurationToDate } from "./durationHms";

export type DriverWaitingConfig = {
	passenger_waiting_time: string;
	still_waiting_button_appear_in: string;
	skip_button_appear_in: string;
};

export type WaitingMilestones = {
	/** T0 + passenger_waiting_time — still-waiting phase starts */
	still_waiting_phase_start_at: Date;
	/** T1 + still_waiting_button_appear_in — skip countdown starts */
	skip_phase_start_at: Date;
	/** T2 + skip_button_appear_in — MOVE_TO_NEXT available */
	move_next_button_at: Date;
};

export type WaitingPhase =
	| "INITIAL_WAIT"
	| "STILL_WAITING_COUNTDOWN"
	| "SKIP_COUNTDOWN"
	| "MOVE_NEXT_READY";

export type PassengerWaitingSchedule = {
	/** T0 + passenger_waiting_time */
	passenger_waiting_notify_at: string | null;
	still_waiting_phase_start_at: string | null;
	skip_phase_start_at: string | null;
	move_next_button_at: string | null;
	still_waiting_phase_notified_at: string | null;
	skip_phase_notified_at: string | null;
	move_next_notified_at: string | null;
	current_phase: WaitingPhase;
	countdown_seconds: number | null;
	show_still_waiting_button: boolean;
	show_move_to_next_button: boolean;
};

export function getArrivalTimestamp(
	phase: "PICKUP" | "DROP",
	driverArrivedAt: Date | null,
	dropoffArrivedAt: Date | null,
): Date | null {
	return phase === "PICKUP" ? driverArrivedAt : dropoffArrivedAt;
}

export function computeWaitingMilestones(
	arrivedAt: Date,
	config: DriverWaitingConfig,
): WaitingMilestones | null {
	const t1 = addHmsDurationToDate(arrivedAt, config.passenger_waiting_time);
	if (!t1) return null;
	const t2 = addHmsDurationToDate(t1, config.still_waiting_button_appear_in);
	if (!t2) return null;
	const t3 = addHmsDurationToDate(t2, config.skip_button_appear_in);
	if (!t3) return null;
	return {
		still_waiting_phase_start_at: t1,
		skip_phase_start_at: t2,
		move_next_button_at: t3,
	};
}

export function buildPassengerWaitingSchedule(params: {
	phase: "PICKUP" | "DROP";
	driver_arrived_at: Date | null;
	dropoff_arrived_at: Date | null;
	still_waiting_phase_notified_at: Date | null;
	skip_phase_notified_at: Date | null;
	move_next_notified_at: Date | null;
	config: DriverWaitingConfig | null;
	now?: Date;
}): PassengerWaitingSchedule {
	const now = params.now ?? new Date();
	const empty: PassengerWaitingSchedule = {
		passenger_waiting_notify_at: null,
		still_waiting_phase_start_at: null,
		skip_phase_start_at: null,
		move_next_button_at: null,
		still_waiting_phase_notified_at:
			params.still_waiting_phase_notified_at?.toISOString() ?? null,
		skip_phase_notified_at:
			params.skip_phase_notified_at?.toISOString() ?? null,
		move_next_notified_at:
			params.move_next_notified_at?.toISOString() ?? null,
		current_phase: "INITIAL_WAIT",
		countdown_seconds: null,
		show_still_waiting_button: false,
		show_move_to_next_button: false,
	};

	const arrivedAt = getArrivalTimestamp(
		params.phase,
		params.driver_arrived_at,
		params.dropoff_arrived_at,
	);
	if (!arrivedAt || !params.config) return empty;

	const milestones = computeWaitingMilestones(arrivedAt, params.config);
	if (!milestones) return empty;

	const { still_waiting_phase_start_at: t1, skip_phase_start_at: t2, move_next_button_at: t3 } =
		milestones;
	const nowMs = now.getTime();

	let current_phase: WaitingPhase = "INITIAL_WAIT";
	let countdown_seconds: number | null = null;

	if (nowMs < t1.getTime()) {
		current_phase = "INITIAL_WAIT";
		countdown_seconds = Math.max(
			0,
			Math.ceil((t1.getTime() - nowMs) / 1000),
		);
	} else if (nowMs < t2.getTime()) {
		current_phase = "STILL_WAITING_COUNTDOWN";
		countdown_seconds = Math.max(
			0,
			Math.ceil((t2.getTime() - nowMs) / 1000),
		);
	} else if (nowMs < t3.getTime()) {
		current_phase = "SKIP_COUNTDOWN";
		countdown_seconds = Math.max(
			0,
			Math.ceil((t3.getTime() - nowMs) / 1000),
		);
	} else {
		current_phase = "MOVE_NEXT_READY";
		countdown_seconds = null;
	}

	const show_still_waiting_button =
		nowMs >= t1.getTime() && nowMs < t3.getTime();
	const show_move_to_next_button = nowMs >= t3.getTime();

	return {
		passenger_waiting_notify_at: t1.toISOString(),
		still_waiting_phase_start_at: t1.toISOString(),
		skip_phase_start_at: t2.toISOString(),
		move_next_button_at: t3.toISOString(),
		still_waiting_phase_notified_at:
			params.still_waiting_phase_notified_at?.toISOString() ?? null,
		skip_phase_notified_at:
			params.skip_phase_notified_at?.toISOString() ?? null,
		move_next_notified_at:
			params.move_next_notified_at?.toISOString() ?? null,
		current_phase,
		countdown_seconds,
		show_still_waiting_button,
		show_move_to_next_button,
	};
}

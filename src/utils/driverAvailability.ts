import { parseTimeToMinutesFromMidnight } from "./pickupSchedule";
import {
	formatUtcDateToHHMM,
	isOfficePickupNextDay,
	resolveDropPhaseDateYmd,
	resolvePhaseStartAt,
	type PassengerTripTimes,
} from "./tripPhaseSchedule";

/** Parse HH:mm:ss duration to minutes (e.g. 01:10:00 → 70). */
export function parseHmsDurationToMinutes(
	raw: string | null | undefined,
): number | null {
	if (raw == null || typeof raw !== "string") return null;
	const m = raw.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	const sec = Number(m[3]);
	if (h > 23 || min > 59 || sec > 59) return null;
	return h * 60 + min + Math.round(sec / 60);
}

/** Server-local clock minutes from midnight (matches trip_start_time HH:MM). */
export function getNowMinutesLocal(): number {
	const now = new Date();
	return now.getHours() * 60 + now.getMinutes();
}

export function formatMinutesToHHMM(totalMinutes: number): string {
	let m = Math.round(totalMinutes) % (24 * 60);
	if (m < 0) m += 24 * 60;
	const h = Math.floor(m / 60);
	const min = m % 60;
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Latest HH:MM clock time from a list of route leg time strings. */
export function maxClockTimeLabel(times: string[]): string | null {
	let bestMinutes: number | null = null;
	let bestLabel: string | null = null;
	for (const raw of times) {
		const trimmed = raw?.trim();
		if (!trimmed) continue;
		const minutes = parseTimeToMinutesFromMidnight(trimmed);
		if (minutes == null) continue;
		if (bestMinutes == null || minutes > bestMinutes) {
			bestMinutes = minutes;
			bestLabel = trimmed;
		}
	}
	return bestLabel;
}

/** Per-trip schedule shown on driver availability (GET /mobile/driver/available). */
export type TripAvailabilitySchedule = {
	scheduled_date: string | null;
	/** Last time driver can mark available (trip_start − availability_time). */
	mark_available_until: string | null;
	/** First pickup / PICKUP phase start (HH:MM). */
	trip_pickup_starts_at: string | null;
	/** Push reminder at trip_start − remaining_start_time (HH:MM). */
	trip_start_reminder_at: string | null;
	/** DROP phase start — office pick-up time from route (HH:MM). */
	drop_phase_starts_at: string | null;
	/** Calendar date for DROP phase when office pick is next day (YYYY-MM-DD). */
	drop_phase_date: string | null;
	/** True when office pick is on the calendar day after plan scheduled_date. */
	office_pickup_is_next_day: boolean;
	/** Planned end — latest passenger dropoff_time on the route (HH:MM). */
	trip_completes_at: string | null;
};

export type AvailabilityUiStatus =
	| "NO_UPCOMING_TRIP"
	| "IN_TRIP"
	| "ALREADY_AVAILABLE"
	| "TOO_EARLY"
	| "OPEN"
	| "DEADLINE_PASSED"
	| "ADMIN_OVERRIDE";

export type AvailabilityPhaseContext = {
	phase_driver_id: number;
	route_daily_plan_id: number;
	phase: "PICKUP" | "DROP";
	trip_start_time: string;
	availability_missed_at: Date | null;
	availability_miss_notified_at: Date | null;
	availability_admin_override_until: Date | null;
	/** Set on DROP rows — pickup start time on the same daily plan. */
	pickup_trip_start_time?: string | null;
	/** Plan anchor date (pickup night) for absolute phase scheduling. */
	plan_scheduled_date?: Date | null;
	/** First-leg times for overnight DROP detection. */
	trip_times?: PassengerTripTimes | null;
};

export type DriverAvailabilityConfig = {
	availability_time: string;
	remaining_start_time: string;
};

export function computeAvailabilityUi(params: {
	is_available: boolean;
	config: DriverAvailabilityConfig;
	/** PICKUP or DROP — incomplete phase that may still need mark-available. */
	nextPhase: AvailabilityPhaseContext | null;
	/** ONGOING phase for resume (`active_trip`); does not block OPEN when drop still needs mark. */
	activePhase?: (AvailabilityPhaseContext & {
		plan_status?: string;
		pickup_trip_start_time?: string | null;
	}) | null;
	now?: Date;
}): {
	show_availability_button: boolean;
	can_mark_available: boolean;
	status: AvailabilityUiStatus;
	must_mark_available_before: string | null;
	window_opens_at: string | null;
	trip_start_time: string | null;
	availability_lead_time: string;
	admin_override_until: string | null;
	admin_override_remaining_seconds: number | null;
	/** When driver gets “start trip” reminder (trip_start − remaining_start_time). */
	trip_start_reminder_at: string | null;
	remaining_start_time: string;
	next_trip: {
		phase_driver_id: number;
		route_daily_plan_id: number;
		phase: "PICKUP" | "DROP";
		trip_start_time: string;
		trip_start_at: string | null;
		office_pickup_is_next_day: boolean;
	} | null;
	/** Same as `next_trip` when a phase is ONGOING — use for resume routing after login. */
	active_trip: {
		phase_driver_id: number;
		route_daily_plan_id: number;
		phase: "PICKUP" | "DROP";
		trip_start_time: string;
		trip_start_at: string | null;
		plan_status: string;
	} | null;
	trip_schedule: TripAvailabilitySchedule | null;
	trip_start_at: string | null;
	office_pickup_is_next_day: boolean;
} {
	const { is_available, config, nextPhase } = params;
	const activePhase = params.activePhase ?? null;
	const now = params.now ?? new Date();
	const nowMinutes = now.getHours() * 60 + now.getMinutes();

	const leadMinutes = parseHmsDurationToMinutes(config.availability_time);
	const remainingMinutes = parseHmsDurationToMinutes(config.remaining_start_time);

	const base = {
		show_availability_button: false,
		can_mark_available: false,
		status: "NO_UPCOMING_TRIP" as AvailabilityUiStatus,
		must_mark_available_before: null as string | null,
		window_opens_at: null as string | null,
		trip_start_time: null as string | null,
		availability_lead_time: config.availability_time,
		admin_override_until: null as string | null,
		admin_override_remaining_seconds: null as number | null,
		trip_start_reminder_at: null as string | null,
		remaining_start_time: config.remaining_start_time,
		next_trip: null as {
			phase_driver_id: number;
			route_daily_plan_id: number;
			phase: "PICKUP" | "DROP";
			trip_start_time: string;
			trip_start_at: string | null;
			office_pickup_is_next_day: boolean;
		} | null,
		active_trip: null as {
			phase_driver_id: number;
			route_daily_plan_id: number;
			phase: "PICKUP" | "DROP";
			trip_start_time: string;
			trip_start_at: string | null;
			plan_status: string;
		} | null,
		trip_schedule: null as TripAvailabilitySchedule | null,
		trip_start_at: null as string | null,
		office_pickup_is_next_day: false,
	};

	if (!nextPhase?.trip_start_time?.trim()) {
		if (activePhase?.trip_start_time?.trim()) {
			const phaseLabel = activePhase.trip_start_time.trim();
			const activeStartAt =
				activePhase.plan_scheduled_date && activePhase.trip_times
					? resolvePhaseStartAt(
							activePhase.plan_scheduled_date,
							activePhase.phase,
							phaseLabel,
							activePhase.trip_times,
						)
					: null;
			const activeTrip = {
				phase_driver_id: activePhase.phase_driver_id,
				route_daily_plan_id: activePhase.route_daily_plan_id,
				phase: activePhase.phase,
				trip_start_time: phaseLabel,
				trip_start_at: activeStartAt?.toISOString() ?? null,
				plan_status: activePhase.plan_status ?? "ONGOING",
			};
			return {
				...base,
				status: "IN_TRIP",
				trip_start_time: phaseLabel,
				trip_start_at: activeStartAt?.toISOString() ?? null,
				active_trip: activeTrip,
			};
		}
		return base;
	}

	const tripTimes = nextPhase.trip_times ?? {
		homePickupTime: null,
		dropOffTime: null,
		officePickUpTime: null,
	};
	const tripStartAt =
		nextPhase.plan_scheduled_date != null
			? resolvePhaseStartAt(
					nextPhase.plan_scheduled_date,
					nextPhase.phase,
					nextPhase.trip_start_time,
					tripTimes,
				)
			: null;
	const officePickupIsNextDay =
		nextPhase.phase === "DROP" && isOfficePickupNextDay(tripTimes);

	const tripStartMinutes = parseTimeToMinutesFromMidnight(
		nextPhase.trip_start_time,
	);
	if ((tripStartAt == null && tripStartMinutes == null) || leadMinutes == null) {
		return base;
	}

	const deadlineAt =
		tripStartAt != null
			? new Date(tripStartAt.getTime() - leadMinutes * 60 * 1000)
			: null;
	const deadlineMinutes =
		tripStartMinutes != null ? tripStartMinutes - leadMinutes : null;

	const tripStartLabel = nextPhase.trip_start_time.trim();
	const deadlineLabel =
		deadlineAt != null
			? formatUtcDateToHHMM(deadlineAt)
			: deadlineMinutes != null
				? formatMinutesToHHMM(deadlineMinutes)
				: null;
	const pickupStart =
		nextPhase.phase === "PICKUP"
			? tripStartLabel
			: (nextPhase.pickup_trip_start_time?.trim() ?? null);
	const dropStart =
		nextPhase.phase === "DROP" ? tripStartLabel : null;

	const upcomingTrip = {
		phase_driver_id: nextPhase.phase_driver_id,
		route_daily_plan_id: nextPhase.route_daily_plan_id,
		phase: nextPhase.phase,
		trip_start_time: tripStartLabel,
		trip_start_at: tripStartAt?.toISOString() ?? null,
		office_pickup_is_next_day: officePickupIsNextDay,
	};
	base.next_trip = upcomingTrip;
	base.trip_start_time = tripStartLabel;
	base.trip_start_at = tripStartAt?.toISOString() ?? null;
	base.office_pickup_is_next_day = officePickupIsNextDay;
	base.must_mark_available_before = deadlineLabel;
	base.window_opens_at = null;
	if (remainingMinutes != null) {
		const remindAt =
			tripStartAt != null
				? new Date(tripStartAt.getTime() - remainingMinutes * 60 * 1000)
				: null;
		base.trip_start_reminder_at =
			remindAt != null
				? formatUtcDateToHHMM(remindAt)
				: tripStartMinutes != null
					? formatMinutesToHHMM(tripStartMinutes - remainingMinutes)
					: null;
	}

	const dropPhaseDate =
		nextPhase.plan_scheduled_date != null && officePickupIsNextDay
			? resolveDropPhaseDateYmd(nextPhase.plan_scheduled_date, tripTimes)
			: nextPhase.plan_scheduled_date != null
				? nextPhase.plan_scheduled_date.toISOString().slice(0, 10)
				: null;

	base.trip_schedule = {
		scheduled_date: null,
		mark_available_until: deadlineLabel,
		trip_pickup_starts_at: pickupStart,
		trip_start_reminder_at: base.trip_start_reminder_at,
		drop_phase_starts_at: dropStart,
		drop_phase_date: nextPhase.phase === "DROP" ? dropPhaseDate : null,
		office_pickup_is_next_day: officePickupIsNextDay,
		trip_completes_at: null,
	};

	if (activePhase?.trip_start_time?.trim()) {
		const phaseLabel = activePhase.trip_start_time.trim();
		const activeStartAt =
			activePhase.plan_scheduled_date && activePhase.trip_times
				? resolvePhaseStartAt(
						activePhase.plan_scheduled_date,
						activePhase.phase,
						phaseLabel,
						activePhase.trip_times,
					)
				: null;
		base.active_trip = {
			phase_driver_id: activePhase.phase_driver_id,
			route_daily_plan_id: activePhase.route_daily_plan_id,
			phase: activePhase.phase,
			trip_start_time: phaseLabel,
			trip_start_at: activeStartAt?.toISOString() ?? null,
			plan_status: activePhase.plan_status ?? "ONGOING",
		};
	}

	if (is_available) {
		return {
			...base,
			status: "ALREADY_AVAILABLE",
		};
	}

	const overrideUntil = nextPhase.availability_admin_override_until;
	if (overrideUntil && overrideUntil.getTime() > now.getTime()) {
		const remainingSec = Math.max(
			0,
			Math.floor((overrideUntil.getTime() - now.getTime()) / 1000),
		);
		return {
			...base,
			show_availability_button: true,
			can_mark_available: true,
			status: "ADMIN_OVERRIDE",
			admin_override_until: overrideUntil.toISOString(),
			admin_override_remaining_seconds: remainingSec,
		};
	}

	const beforeDeadline =
		deadlineAt != null
			? now.getTime() < deadlineAt.getTime()
			: deadlineMinutes != null && nowMinutes < deadlineMinutes;

	if (beforeDeadline) {
		return {
			...base,
			show_availability_button: true,
			can_mark_available: true,
			status: "OPEN",
		};
	}

	return {
		...base,
		status: "DEADLINE_PASSED",
	};
}

/** True when clock has reached the availability deadline for a phase row. */
export function hasReachedAvailabilityDeadline(
	tripStartTime: string,
	availabilityTimeHms: string,
	now?: Date,
	schedule?: {
		planScheduledDate: Date;
		phase: "PICKUP" | "DROP";
		tripTimes: PassengerTripTimes;
	},
): boolean {
	const leadMin = parseHmsDurationToMinutes(availabilityTimeHms);
	if (leadMin == null) return false;

	const n = now ?? new Date();

	if (schedule?.planScheduledDate) {
		const tripStartAt = resolvePhaseStartAt(
			schedule.planScheduledDate,
			schedule.phase,
			tripStartTime,
			schedule.tripTimes,
		);
		if (tripStartAt) {
			const deadlineAt = new Date(tripStartAt.getTime() - leadMin * 60 * 1000);
			return n.getTime() >= deadlineAt.getTime();
		}
	}

	const tripMin = parseTimeToMinutesFromMidnight(tripStartTime);
	if (tripMin == null) return false;
	const deadlineMin = tripMin - leadMin;
	const nowMin = n.getHours() * 60 + n.getMinutes();
	return nowMin >= deadlineMin;
}

/** Clock time (HH:MM) when trip-start reminder should fire: trip_start − remaining_start_time. */
export function getTripStartReminderAt(
	tripStartTime: string,
	remainingStartTimeHms: string,
): string | null {
	const tripMin = parseTimeToMinutesFromMidnight(tripStartTime);
	const remainingMin = parseHmsDurationToMinutes(remainingStartTimeHms);
	if (tripMin == null || remainingMin == null) return null;
	return formatMinutesToHHMM(tripMin - remainingMin);
}

/** True when local clock has reached trip_start − remaining_start_time. */
export function hasReachedTripStartReminderTime(
	tripStartTime: string,
	remainingStartTimeHms: string,
	now?: Date,
	schedule?: {
		planScheduledDate: Date;
		phase: "PICKUP" | "DROP";
		tripTimes: PassengerTripTimes;
	},
): boolean {
	const remainingMin = parseHmsDurationToMinutes(remainingStartTimeHms);
	if (remainingMin == null) return false;

	const n = now ?? new Date();

	if (schedule?.planScheduledDate) {
		const tripStartAt = resolvePhaseStartAt(
			schedule.planScheduledDate,
			schedule.phase,
			tripStartTime,
			schedule.tripTimes,
		);
		if (tripStartAt) {
			const remindAt = new Date(
				tripStartAt.getTime() - remainingMin * 60 * 1000,
			);
			return n.getTime() >= remindAt.getTime();
		}
	}

	const tripMin = parseTimeToMinutesFromMidnight(tripStartTime);
	if (tripMin == null) return false;
	const remindAtMin = tripMin - remainingMin;
	const nowMin = n.getHours() * 60 + n.getMinutes();
	return nowMin >= remindAtMin;
}

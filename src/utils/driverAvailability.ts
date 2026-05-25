import { parseTimeToMinutesFromMidnight } from "./pickupSchedule";

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

export type AvailabilityUiStatus =
	| "NO_UPCOMING_TRIP"
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
};

export type DriverAvailabilityConfig = {
	availability_time: string;
	remaining_start_time: string;
};

export function computeAvailabilityUi(params: {
	is_available: boolean;
	config: DriverAvailabilityConfig;
	nextPickup: AvailabilityPhaseContext | null;
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
		phase: "PICKUP";
		trip_start_time: string;
	} | null;
} {
	const { is_available, config, nextPickup } = params;
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
			phase: "PICKUP";
			trip_start_time: string;
		} | null,
	};

	if (!nextPickup?.trip_start_time?.trim()) {
		return base;
	}

	const tripStartMinutes = parseTimeToMinutesFromMidnight(
		nextPickup.trip_start_time,
	);
	if (tripStartMinutes == null || leadMinutes == null) {
		return base;
	}

	const deadlineMinutes = tripStartMinutes - leadMinutes;

	const tripStartLabel = nextPickup.trip_start_time.trim();
	const deadlineLabel = formatMinutesToHHMM(deadlineMinutes);

	base.next_trip = {
		phase_driver_id: nextPickup.phase_driver_id,
		route_daily_plan_id: nextPickup.route_daily_plan_id,
		phase: "PICKUP",
		trip_start_time: tripStartLabel,
	};
	base.trip_start_time = tripStartLabel;
	base.must_mark_available_before = deadlineLabel;
	/** No early lockout — driver may mark any time before `must_mark_available_before`. */
	base.window_opens_at = null;
	if (remainingMinutes != null) {
		base.trip_start_reminder_at = formatMinutesToHHMM(
			tripStartMinutes - remainingMinutes,
		);
	}

	if (is_available) {
		return {
			...base,
			status: "ALREADY_AVAILABLE",
		};
	}

	const overrideUntil = nextPickup.availability_admin_override_until;
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

	if (nowMinutes < deadlineMinutes) {
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

/** True when local clock has reached the availability deadline for this pickup row. */
export function hasReachedAvailabilityDeadline(
	tripStartTime: string,
	availabilityTimeHms: string,
	now?: Date,
): boolean {
	const tripMin = parseTimeToMinutesFromMidnight(tripStartTime);
	const leadMin = parseHmsDurationToMinutes(availabilityTimeHms);
	if (tripMin == null || leadMin == null) return false;
	const deadlineMin = tripMin - leadMin;
	const n = now ?? new Date();
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
): boolean {
	const tripMin = parseTimeToMinutesFromMidnight(tripStartTime);
	const remainingMin = parseHmsDurationToMinutes(remainingStartTimeHms);
	if (tripMin == null || remainingMin == null) return false;
	const remindAtMin = tripMin - remainingMin;
	const n = now ?? new Date();
	const nowMin = n.getHours() * 60 + n.getMinutes();
	return nowMin >= remindAtMin;
}

/** Parse "HH:MM" or "H:MM" (24h) to minutes from midnight; null if invalid. */
export function parseTimeToMinutesFromMidnight(raw: string | null | undefined): number | null {
	if (raw == null || typeof raw !== "string") return null;
	const s = raw.trim();
	const m = /^(\d{1,2}):(\d{2})$/.exec(s);
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 23 || min > 59 || h < 0 || min < 0) return null;
	return h * 60 + min;
}

/** Format minutes from midnight as "HH:MM" (24h). */
export function formatMinutesFromMidnightToHHMM(totalMinutes: number): string {
	let m = Math.round(totalMinutes) % (24 * 60);
	if (m < 0) m += 24 * 60;
	const h = Math.floor(m / 60);
	const min = m % 60;
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Seconds since midnight from minutes+seconds fractional part. */
export function formatSecondsFromMidnightToHHMM(seconds: number): string {
	let s = Math.round(seconds) % (86400);
	if (s < 0) s += 86400;
	const totalMin = s / 60;
	return formatMinutesFromMidnightToHHMM(totalMin);
}

/** Sort route legs for driver queue: PICKUP by pickup_time, DROP by drop_sequence then pickup_time. */
export function compareRouteLegsForDriverQueue<
	T extends {
		pickup_time: string;
		sequence: number;
		drop_sequence: number;
	},
>(a: T, b: T, phase: "PICKUP" | "DROP"): number {
	if (phase === "DROP" && a.drop_sequence !== b.drop_sequence) {
		return a.drop_sequence - b.drop_sequence;
	}
	const ma = parseTimeToMinutesFromMidnight(a.pickup_time);
	const mb = parseTimeToMinutesFromMidnight(b.pickup_time);
	if (ma !== null && mb !== null && ma !== mb) return ma - mb;
	if (ma === null && mb !== null) return 1;
	if (mb === null && ma !== null) return -1;
	return phase === "PICKUP" ? a.sequence - b.sequence : a.drop_sequence - b.drop_sequence;
}

export function sortRouteLegsByPickupTime<
	T extends {
		pickup_time: string;
		sequence: number;
		drop_sequence: number;
	},
>(legs: T[], phase: "PICKUP" | "DROP" = "PICKUP"): T[] {
	return [...legs].sort((a, b) => compareRouteLegsForDriverQueue(a, b, phase));
}

export function getOfficeArrivalBufferMinutes(): number {
	const raw = process.env.ROUTE_OFFICE_ARRIVAL_BUFFER_MINUTES;
	const n = raw != null ? Number(raw) : NaN;
	if (Number.isFinite(n) && n >= 0 && n <= 30) return n;
	return 7;
}

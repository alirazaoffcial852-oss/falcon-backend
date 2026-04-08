/** UTC calendar date (no time). */
export function getLocalDateOnly(d: Date = new Date()): Date {
	const x = new Date(d);
	return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

/** Add N calendar days (UTC midnight) to a date-only value. */
export function addLocalDays(dateOnly: Date, days: number): Date {
	const x = getLocalDateOnly(dateOnly);
	x.setUTCDate(x.getUTCDate() + days);
	return x;
}

/** Tomorrow (relative to server local date). */
export function getTomorrowLocalDateOnly(d: Date = new Date()): Date {
	return addLocalDays(d, 1);
}

/** Parse YYYY-MM-DD as UTC date-only value. */
export function parseLocalYmd(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw new Error("Invalid YYYY-MM-DD");
	return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Inclusive end date for a plan: start + `months` calendar months, minus one day.
 * e.g. start Feb 1, months 1 → Feb 28/29.
 */
export function computeInclusivePlanEnd(start: Date, months: number): Date {
	const end = new Date(start);
	end.setUTCHours(0, 0, 0, 0);
	end.setUTCMonth(end.getUTCMonth() + months);
	end.setUTCDate(end.getUTCDate() - 1);
	return end;
}

/** True if `day` (local midnight) falls within [start, end] inclusive. */
export function isDateInPlanWindow(
	day: Date,
	planStart: Date | null,
	planEnd: Date | null,
): boolean {
	if (!planStart || !planEnd) return false;
	const t = getLocalDateOnly(day).getTime();
	return (
		getLocalDateOnly(planStart).getTime() <= t &&
		t <= getLocalDateOnly(planEnd).getTime()
	);
}

/** Parse HH:mm:ss duration to milliseconds (e.g. 00:05:00 → 5 min). */
export function parseHmsDurationToMs(
	raw: string | null | undefined,
): number | null {
	if (raw == null || typeof raw !== "string") return null;
	const m = raw.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	const sec = Number(m[3]);
	if (h > 23 || min > 59 || sec > 59) return null;
	return (h * 3600 + min * 60 + sec) * 1000;
}

export function addHmsDurationToDate(
	base: Date,
	hms: string | null | undefined,
): Date | null {
	const ms = parseHmsDurationToMs(hms);
	if (ms == null) return null;
	return new Date(base.getTime() + ms);
}

/** Parse query/body booleans from true/false, 1/0, TRUE/FALSE (case-insensitive). */
export function parseOptionalBoolean(value: unknown): boolean | undefined {
	if (value === true || value === false) return value;
	if (value === undefined || value === null || value === "") return undefined;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true" || normalized === "1") return true;
		if (normalized === "false" || normalized === "0") return false;
	}
	return undefined;
}

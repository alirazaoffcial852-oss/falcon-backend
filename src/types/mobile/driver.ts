export interface UpdateDriverLocationInput {
	lat: number;
	long: number;
}

export type LegAction =
	| "PICKED"
	| "STILL_WAITING"
	| "MOVE_TO_NEXT"
	| "DROPPED";

export interface LegActionInput {
	action: LegAction;
	/** Required when action is PICKED — driver GPS at pick time */
	lat?: number;
	/** Required when action is PICKED — driver GPS at pick time */
	long?: number;
	/** ISO 8601 — optional; only used when action is DROPPED on DROP segment */
	dropped_at?: string;
}

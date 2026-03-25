export interface UpdateDriverLocationInput {
	lat: number;
	long: number;
}

export type LegAction = "PICKED" | "STILL_WAITING" | "MOVE_TO_NEXT";

export interface LegActionInput {
	action: LegAction;
}

export interface RouteLegInput {
	passengerId: number;
	pickupAddress: string;
	pickupLat: number;
	pickupLong: number;
	pickupTime: string;
	pickupStatus?: "PENDING" | "ONGOING" | "COMPLETED" | "CANCELLED";
	dropoffAddress: string;
	dropoffLat: number;
	dropoffLong: number;
	dropoffTime: string;
	dropoffStatus?: "PENDING" | "ONGOING" | "COMPLETED" | "CANCELLED";
	tollAmount?: number | null;
}

/** One car-load: multiple passengers, then office; later a matching drop leg. */
export interface RouteBatchInput {
	legs: RouteLegInput[];
}

export interface CreateRouteInput {
	companyId: number;
	driverId: number;
	officeAddress: string;
	officeLat: number;
	officeLong: number;
	/** One or more batches. Omit if using legacy `legs` (single batch). */
	batches?: RouteBatchInput[];
	/** @deprecated use batches: [{ legs }] */
	legs?: RouteLegInput[];
}

export interface UpdateRouteInput {
	companyId?: number;
	driverId?: number;
	officeAddress?: string;
	officeLat?: number;
	officeLong?: number;
	batches?: RouteBatchInput[];
}

export interface RouteListQuery {
	page: number;
	limit: number;
	search?: string;
	status?: "PENDING" | "ONGOING" | "COMPLETED" | "CANCELLED";
	companyId?: number;
	driverId?: number;
}

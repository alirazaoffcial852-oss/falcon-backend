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

export interface CreateRouteInput {
	companyId: number;
	driverId: number;
	officeAddress: string;
	officeLat: number;
	officeLong: number;
	legs: RouteLegInput[];
}

export interface UpdateRouteInput {
	companyId?: number;
	driverId?: number;
	officeAddress?: string;
	officeLat?: number;
	officeLong?: number;
	legs?: RouteLegInput[];
}

export interface RouteListQuery {
	page: number;
	limit: number;
	search?: string;
	status?: "PENDING" | "ONGOING" | "COMPLETED" | "CANCELLED";
	companyId?: number;
	driverId?: number;
}

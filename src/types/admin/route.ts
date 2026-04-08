export interface RouteLegInput {
	passengerId: number;
	pickupAddress: string;
	pickupLat: number;
	pickupLong: number;
	/** Omit to compute from passenger `drop_off_time` + directions after route optimize. */
	pickupTime?: string;
	pickupStatus?: "PENDING" | "ONGOING" | "COMPLETED" | "CANCELLED";
	dropoffAddress: string;
	dropoffLat: number;
	dropoffLong: number;
	/** Omit to use passenger `drop_off_time` when computing pickup schedule. */
	dropoffTime?: string;
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
	routePrice?: number | null;
	/** Inclusive recurring window on this definition route (default 1 month). Use `0` to disable cron. */
	recurringPlanStartDate?: string;
	/** Alias for create API compatibility (YYYY-MM-DD). */
	recurring_plan_start?: string;
	recurringPlanMonths?: number;
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
	routePrice?: number | null;
	batches?: RouteBatchInput[];
	recurringPlanStartDate?: string;
	recurring_plan_start?: string;
	recurringPlanMonths?: number;
}

export interface RouteListQuery {
	page: number;
	limit: number;
	search?: string;
	companyId?: number;
	driverId?: number;
	status?: 'PENDING' | 'ONGOING' | 'COMPLETED';
}

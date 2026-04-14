export interface DriverListQuery {
	page: number;
	limit: number;
	search?: string;
}

export interface Driver {
	id?: number;
	email?: string;
	/** Optional fixed home coordinates for route pickup ordering; geocoded from address on first route if omitted */
	home_lat?: number | null;
	home_long?: number | null;
	name: string;
	phone_no?: string | null;
	address: string;
	emergency_phone_no: string;
	driver_image_url: string;
	rate_per_km?: number;
	driver_cnic_front_url: string;
	driver_cnic_back_url: string;
	driver_license_front_url: string;
	driver_license_back_url: string;
	status?: "PENDING" | "APPROVED";
	car_ids?: number[];
	default_car_id?: number | null;
	car_id?: number | null;
	car_name?: string | null;
	car_number?: string | null;
}

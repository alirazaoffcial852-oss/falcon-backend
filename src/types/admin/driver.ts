export interface DriverListQuery {
	page: number;
	limit: number;
	search?: string;
}

export interface Driver {
	name: string;
	phone_no: string;
	address: string;
	emergency_phone_no: string;
	driver_image_url: string;
	rate_per_km?: number;
	driver_cnic_front_url: string;
	driver_cnic_back_url: string;
	salary: string;
	driver_license_front_url: string;
	driver_license_back_url: string;
	car_id: number;
}

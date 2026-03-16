export interface CarListQuery {
	page: number;
	limit: number;
	search?: string;
}

export interface Car {
	name: string;
	engine_capacity: string;
	model: string;
	car_no: string;
	car_color: string;
	fuel_per_km?: string;
	car_front_image_url: string;
	car_back_image_url: string;
	car_front_card_url: string;
	car_back_card_url: string;
}

import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { CarListQuery, Car } from "../types/admin/car";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class CarService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: CarListQuery) {
		const where = buildWhereCondition(params, [
			"name",
			"model",
			"car_no",
			"car_color",
		]);
		const total = await this.db.car.count({ where });
		const data = await this.db.car.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
		});
		return {
			data,
			pagination: {
				total,
				page: params.page,
				limit: params.limit,
				total_pages: Math.ceil(total / params.limit),
			},
		};
	}

	async getById(id: number) {
		const car = await this.db.car.findUnique({ where: { id } });
		if (!car)
			throw ResponseHandler.notFound("No car found against this id: " + id);
		return car;
	}

	async create(data: Car): Promise<Car> {
		const car = await this.db.car.create({
			data: {
				name: data.name,
				engine_capacity: data.engine_capacity,
				model: data.model,
				car_no: data.car_no,
				car_color: data.car_color,
				fuel_per_km: data.fuel_per_km ?? null,
				car_front_image_url: data.car_front_image_url,
				car_back_image_url: data.car_back_image_url,
				car_front_card_url: data.car_front_card_url,
				car_back_card_url: data.car_back_card_url,
			},
		});
		return {
			name: car.name,
			engine_capacity: car.engine_capacity,
			model: car.model,
			car_no: car.car_no,
			car_color: car.car_color,
			fuel_per_km: car.fuel_per_km ?? undefined,
			car_front_image_url: car.car_front_image_url,
			car_back_image_url: car.car_back_image_url,
			car_front_card_url: car.car_front_card_url,
			car_back_card_url: car.car_back_card_url,
		};
	}

	async update(id: number, data: Car): Promise<Car> {
		await this.getById(id);
		const car = await this.db.car.update({
			where: { id },
			data: {
				name: data.name,
				engine_capacity: data.engine_capacity,
				model: data.model,
				car_no: data.car_no,
				car_color: data.car_color,
				fuel_per_km: data.fuel_per_km ?? null,
				car_front_image_url: data.car_front_image_url,
				car_back_image_url: data.car_back_image_url,
				car_front_card_url: data.car_front_card_url,
				car_back_card_url: data.car_back_card_url,
			},
		});
		return {
			name: car.name,
			engine_capacity: car.engine_capacity,
			model: car.model,
			car_no: car.car_no,
			car_color: car.car_color,
			fuel_per_km: car.fuel_per_km ?? undefined,
			car_front_image_url: car.car_front_image_url,
			car_back_image_url: car.car_back_image_url,
			car_front_card_url: car.car_front_card_url,
			car_back_card_url: car.car_back_card_url,
		};
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.car.delete({ where: { id } });
	}
}

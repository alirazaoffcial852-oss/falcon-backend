import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { DriverListQuery, Driver } from "../types/admin/driver";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class DriverService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: DriverListQuery) {
		const where = buildWhereCondition(params, ["name", "address", "phone_no"]);
		const total = await this.db.driver.count({ where });
		const data = await this.db.driver.findMany({
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
		const driver = await this.db.driver.findUnique({ where: { id } });
		if (!driver)
			throw ResponseHandler.notFound("No driver found against this id: " + id);
		return driver;
	}

	async create(data: Driver): Promise<Driver> {
		const driver = await this.db.$transaction(async (tx) => {
			const createdDriver = await tx.driver.create({
				data: {
					name: data.name,
					phone_no: data.phone_no,
					address: data.address,
					emergency_phone_no: data.emergency_phone_no,
					driver_image_url: data.driver_image_url ?? "",
					rate_per_km:
						data.rate_per_km !== undefined && data.rate_per_km !== null
							? Number(data.rate_per_km)
							: 0,
					driver_cnic_front_url: data.driver_cnic_front_url ?? "",
					driver_cnic_back_url: data.driver_cnic_back_url ?? "",
					salary: data.salary ?? "",
					driver_license_front_url: data.driver_license_front_url ?? "",
					driver_license_back_url: data.driver_license_back_url ?? "",
				},
			});

			if (data.car_id) {
				await tx.driverAssignCar.create({
					data: {
						driver_id: createdDriver.id,
						car_id: Number(data.car_id),
					},
				});
			}

			return createdDriver;
		});

		return {
			...driver,
			car_id: Number(data.car_id),
		};
	}

	async update(id: number, data: Driver) {
		await this.getById(id);
		const driver = await this.db.driver.update({
			where: { id },
			data: {
				name: data.name,
				phone_no: data.phone_no,
				address: data.address,
				emergency_phone_no: data.emergency_phone_no,
				driver_image_url: data.driver_image_url ?? "",
				rate_per_km:
					data.rate_per_km !== undefined && data.rate_per_km !== null
						? Number(data.rate_per_km)
						: 0,
				driver_cnic_front_url: data.driver_cnic_front_url ?? "",
				driver_cnic_back_url: data.driver_cnic_back_url ?? "",
				salary: data.salary ?? "",
				driver_license_front_url: data.driver_license_front_url ?? "",
				driver_license_back_url: data.driver_license_back_url ?? "",
			},
		});

		let carId: number | undefined;
		if (data.car_id !== undefined && data.car_id !== null) {
			const existing = await this.db.driverAssignCar.findFirst({
				where: { driver_id: id, car_id: Number(data.car_id) },
			});
			if (existing) {
				const updated = await this.db.driverAssignCar.update({
					where: { id: existing.id },
					data: { car_id: Number(data.car_id) },
				});
				carId = updated.car_id;
			} else {
				const created = await this.db.driverAssignCar.create({
					data: { driver_id: id, car_id: Number(data.car_id) },
				});
				carId = created.car_id;
			}
		}
		return {
			...driver,
			...(carId !== undefined && { car_id: carId }),
		};
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.driver.delete({ where: { id } });
	}
}

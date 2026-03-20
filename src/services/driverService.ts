import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { DriverListQuery, Driver } from "../types/admin/driver";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class DriverService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: DriverListQuery) {
		const where = buildWhereCondition(params, [
			"name",
			"address",
			"phone_no",
			"emergency_phone_no",
		]);
		const total = await this.db.driver.count({ where });
		const drivers = await this.db.driver.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
			include: {
				driver_assign_cars: {
					orderBy: { created_at: "desc" },
					take: 1,
					include: { car: true },
				},
			},
		});
		const data = drivers.map((driver) => {
			const assignedCar = driver.driver_assign_cars[0];
			return {
				...driver,
				car_id: assignedCar?.car_id ?? null,
				car_name: assignedCar?.car?.name ?? null,
				car_number: assignedCar?.car?.car_no ?? null,
				driver_assign_cars: undefined,
			};
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
		const driver = await this.db.driver.findUnique({
			where: { id },
			include: {
				driver_assign_cars: {
					orderBy: { created_at: "desc" },
					take: 1,
					include: { car: true },
				},
			},
		});
		if (!driver)
			throw ResponseHandler.notFound("No driver found against this id: " + id);
		const assignedCar = driver.driver_assign_cars[0];
		return {
			...driver,
			car_id: assignedCar?.car_id ?? null,
			car_name: assignedCar?.car?.name ?? null,
			car_number: assignedCar?.car?.car_no ?? null,
			driver_assign_cars: undefined,
		};
	}

	async create(data: Driver): Promise<Driver> {
		const createdDriver = await this.db.$transaction(async (tx) => {
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
		return this.getById(createdDriver.id);
	}

	async update(id: number, data: Driver) {
		await this.getById(id);
		await this.db.driver.update({
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

		if (data.car_id !== undefined && data.car_id !== null) {
			const existingForDriver = await this.db.driverAssignCar.findFirst({
				where: { driver_id: id },
				orderBy: { created_at: "desc" },
			});
			if (existingForDriver) {
				await this.db.driverAssignCar.update({
					where: { id: existingForDriver.id },
					data: { car_id: Number(data.car_id) },
				});
			} else {
				await this.db.driverAssignCar.create({
					data: { driver_id: id, car_id: Number(data.car_id) },
				});
			}
		}
		return this.getById(id);
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.driver.delete({ where: { id } });
	}
}

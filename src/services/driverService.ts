import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { DriverListQuery, Driver } from "../types/admin/driver";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import bcrypt from "bcryptjs";
import { generateRandomNumericPassword } from "../utils/generateRandomPassword";
import { sendCredentialEmail } from "../utils/email";

export class DriverService {
	private db = DatabaseService.getInstance().getPrisma();

	private async ensureCarExists(carId: number | null): Promise<void> {
		if (!carId) return;
		const carExists = await this.db.car.findUnique({ where: { id: carId } });
		if (!carExists) {
			throw ResponseHandler.badRequest(`Car with ID ${carId} does not exist`);
		}
	}

	private async createApprovedDriver(data: Driver): Promise<Driver> {
		if (!data.email) {
			throw ResponseHandler.badRequest("Email is required");
		}
		const email = data.email.trim().toLowerCase();
		const existingUser = await this.db.user.findUnique({ where: { email } });
		if (existingUser) {
			throw ResponseHandler.duplicateResource("User", "email");
		}

		const plainPassword = generateRandomNumericPassword(6, 8);
		const hashedPassword = await bcrypt.hash(plainPassword, 10);

		const carId = data.car_id ? Number(data.car_id) : null;
		await this.ensureCarExists(carId);

		const driver = await this.db.$transaction(async (tx) => {
			const createdUser = await tx.user.create({
				data: {
					email,
					password: hashedPassword,
					role_id: 2,
				},
			});

			const createdDriver = await tx.driver.create({
				data: {
					user_id: createdUser.id,
					name: data.name,
					phone_no: data.phone_no,
					address: data.address,
					...(data.home_lat !== undefined &&
						data.home_lat !== null && { home_lat: Number(data.home_lat) }),
					...(data.home_long !== undefined &&
						data.home_long !== null && { home_long: Number(data.home_long) }),
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
					status: "APPROVED",
				},
			});

			if (carId) {
				await tx.driverAssignCar.create({
					data: {
						driver_id: createdDriver.id,
						car_id: carId,
					},
				});
			}

			return createdDriver;
		});

		await sendCredentialEmail(email, "driver", plainPassword);

		return {
			email,
			...driver,
			car_id: carId,
		};
	}

	private async createPendingDriver(data: Driver): Promise<{ id: number }> {
		const carId = data.car_id ? Number(data.car_id) : null;
		await this.ensureCarExists(carId);

		const driver = await this.db.driver.create({
			data: {
				name: data.name,
				phone_no: data.phone_no,
				address: data.address,
				...(data.home_lat !== undefined &&
					data.home_lat !== null && { home_lat: Number(data.home_lat) }),
				...(data.home_long !== undefined &&
					data.home_long !== null && { home_long: Number(data.home_long) }),
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
				status: "PENDING",
			},
			select: { id: true },
		});

		if (carId) {
			await this.db.driverAssignCar.create({
				data: {
					driver_id: driver.id,
					car_id: carId,
				},
			});
		}
		return driver;
	}

	async list(params: DriverListQuery) {
		const where = buildWhereCondition(params, [
			"name",
			"address",
			"phone_no",
			"emergency_phone_no",
			"salary",
			"rate_per_km",
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
				user: { select: { email: true } },
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
				email: driver.user?.email ?? null,
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
				user: { select: { email: true } },
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
			email: driver.user?.email ?? null,
		};
	}

	async create(
		data: Driver,
		context?: { requesterRole?: string; requesterUserId?: number },
	): Promise<Driver | { request_id: number; status: string; message: string }> {
		if (context?.requesterRole === "driver") {
			const prisma = this.db as any;
			const pendingDriver = await this.createPendingDriver(data);
			const req = await prisma.driverCreateRequest.create({
				data: {
					requested_by_user_id: context.requesterUserId ?? null,
					payload: data as unknown as object,
					status: "PENDING",
					created_driver_id: pendingDriver.id,
				},
			});
			return {
				request_id: req.id,
				status: req.status,
				message:
					"Driver creation request submitted with pending status. Admin approval is required.",
			};
		}
		return this.createApprovedDriver(data);
	}

	async approveCreateRequest(requestId: number, adminUserId: number) {
		const prisma = this.db as any;
		const req = await prisma.driverCreateRequest.findUnique({
			where: { id: requestId },
		});
		if (!req) throw ResponseHandler.notFound("Driver create request", requestId);
		if (req.status !== "PENDING") {
			throw ResponseHandler.badRequest("This request is already reviewed");
		}
		const payload = req.payload as unknown as Driver;
		let created: Driver;
		if (req.created_driver_id) {
			if (!payload.email) {
				throw ResponseHandler.badRequest(
					"Cannot approve request: email missing in payload",
				);
			}
			const email = payload.email.trim().toLowerCase();
			const existingUser = await this.db.user.findUnique({ where: { email } });
			if (existingUser) {
				throw ResponseHandler.duplicateResource("User", "email");
			}
			const plainPassword = generateRandomNumericPassword(6, 8);
			const hashedPassword = await bcrypt.hash(plainPassword, 10);
			const approved = await this.db.$transaction(async (tx) => {
				const createdUser = await tx.user.create({
					data: {
						email,
						password: hashedPassword,
						role_id: 2,
					},
				});
				return tx.driver.update({
					where: { id: req.created_driver_id },
					data: {
						user_id: createdUser.id,
						status: "APPROVED",
					},
				});
			});
			await sendCredentialEmail(email, "driver", plainPassword);
			created = {
				email,
				...approved,
			};
		} else {
			created = await this.createApprovedDriver(payload);
		}
		await prisma.driverCreateRequest.update({
			where: { id: requestId },
			data: {
				status: "APPROVED",
				reviewed_by_user_id: adminUserId,
				reviewed_at: new Date(),
				created_driver_id: created.id,
			},
		});
		return created;
	}

	async listCreateRequests(params: {
		page: number;
		limit: number;
		status?: "PENDING" | "APPROVED";
	}) {
		const where =
			params.status && params.status.length > 0
				? { status: params.status }
				: undefined;
		const prisma = this.db as any;
		const total = await prisma.driverCreateRequest.count({ where });
		const rows = await prisma.driverCreateRequest.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
			include: {
				requested_by_user: { select: { id: true, email: true } },
				reviewed_by_user: { select: { id: true, email: true } },
				created_driver: {
					select: { id: true, name: true, phone_no: true, status: true },
				},
			},
		});
		return {
			data: rows,
			pagination: {
				total,
				page: params.page,
				limit: params.limit,
				total_pages: Math.ceil(total / params.limit),
			},
		};
	}

	async update(id: number, data: Driver) {
		await this.getById(id);
		await this.db.driver.update({
			where: { id },
			data: {
				name: data.name,
				phone_no: data.phone_no,
				address: data.address,
				...(data.home_lat !== undefined && {
					home_lat:
						data.home_lat === null ? null : Number(data.home_lat),
				}),
				...(data.home_long !== undefined && {
					home_long:
						data.home_long === null ? null : Number(data.home_long),
				}),
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

import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type {
	CreateRouteInput,
	UpdateRouteInput,
	RouteListQuery,
} from "../types/admin/route";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class RouteService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: RouteListQuery) {
		const where = buildWhereCondition(params, ["office_address"], ["status"]);
		if (params.companyId !== undefined) where.company_id = params.companyId;
		if (params.driverId !== undefined) where.driver_id = params.driverId;

		const total = await this.db.route.count({ where });
		const data = await this.db.route.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
			include: {
				company: { select: { id: true, name: true } },
				driver: { select: { id: true, name: true } },
				legs: {
					include: {
						passenger: { select: { id: true, name: true } },
					},
				},
			},
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
		const route = await this.db.route.findUnique({
			where: { id },
			include: {
				company: true,
				driver: true,
				legs: { include: { passenger: true } },
			},
		});
		if (!route)
			throw ResponseHandler.notFound("No route found against this id: " + id);
		return route;
	}

	async create(data: CreateRouteInput) {
		const route = await this.db.$transaction(async (tx) => {
			const created = await tx.route.create({
				data: {
					company_id: data.companyId,
					driver_id: data.driverId,
					office_address: data.officeAddress.trim(),
					office_lat: data.officeLat,
					office_long: data.officeLong,
					status: "PENDING",
					legs: {
						create: data.legs.map((leg) => ({
							passenger_id: leg.passengerId,
							pickup_address: leg.pickupAddress.trim(),
							pickup_lat: leg.pickupLat,
							pickup_long: leg.pickupLong,
							pickup_time: leg.pickupTime.trim(),
							dropoff_address: leg.dropoffAddress.trim(),
							dropoff_lat: leg.dropoffLat,
							dropoff_long: leg.dropoffLong,
							dropoff_time: leg.dropoffTime.trim(),
							toll_amount: leg.tollAmount ?? null,
						})),
					},
				},
				include: {
					company: { select: { id: true, name: true } },
					driver: { select: { id: true, name: true } },
					legs: {
						include: { passenger: { select: { id: true, name: true } } },
					},
				},
			});
			return created;
		});
		return route;
	}

	async update(id: number, data: UpdateRouteInput) {
		await this.getById(id);

		if (data.legs !== undefined && data.legs.length > 0) {
			const legs = data.legs;
			await this.db.$transaction(async (tx) => {
				await tx.routeLeg.deleteMany({ where: { route_id: id } });
				await tx.route.update({
					where: { id },
					data: {
						...(data.companyId !== undefined && { company_id: data.companyId }),
						...(data.driverId !== undefined && { driver_id: data.driverId }),
						...(data.officeAddress !== undefined && {
							office_address: data.officeAddress.trim(),
						}),
						...(data.officeLat !== undefined && { office_lat: data.officeLat }),
						...(data.officeLong !== undefined && {
							office_long: data.officeLong,
						}),
						legs: {
							create: legs.map((leg) => ({
								passenger_id: leg.passengerId,
								pickup_address: leg.pickupAddress.trim(),
								pickup_lat: leg.pickupLat,
								pickup_long: leg.pickupLong,
								pickup_time: leg.pickupTime.trim(),
								dropoff_address: leg.dropoffAddress.trim(),
								dropoff_lat: leg.dropoffLat,
								dropoff_long: leg.dropoffLong,
								dropoff_time: leg.dropoffTime.trim(),
								toll_amount: leg.tollAmount ?? null,
							})),
						},
					},
				});
			});
		} else {
			await this.db.route.update({
				where: { id },
				data: {
					...(data.companyId !== undefined && { company_id: data.companyId }),
					...(data.driverId !== undefined && { driver_id: data.driverId }),
					...(data.officeAddress !== undefined && {
						office_address: data.officeAddress.trim(),
					}),
					...(data.officeLat !== undefined && { office_lat: data.officeLat }),
					...(data.officeLong !== undefined && {
						office_long: data.officeLong,
					}),
				},
			});
		}

		return this.getById(id);
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.route.delete({ where: { id } });
	}
}

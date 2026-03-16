import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { PassengerListQuery, Passenger } from "../types/admin/passenger";
import { buildWhereCondition } from "../utils/buildWhereCondition";

export class PassengerService {
	private db = DatabaseService.getInstance().getPrisma();

	async list(params: PassengerListQuery) {
		let total = 0;
		const where = buildWhereCondition(params, ["name"]);
		total = await this.db.passenger.count({ where });
		const passengers = await this.db.passenger.findMany({
			where,
			take: params.limit,
			skip: (params.page - 1) * params.limit,
			orderBy: { created_at: "desc" },
			include: { company: { select: { id: true, name: true } } },
		});
		return {
			data: passengers,
			pagination: {
				total,
				page: params.page,
				limit: params.limit,
				total_pages: Math.ceil(total / params.limit),
			},
		};
	}

	async getById(id: number) {
		const passenger = await this.db.passenger.findUnique({
			where: { id },
			include: { company: true },
		});
		if (!passenger)
			throw ResponseHandler.notFound(
				"No passenger found against this id: " + id,
			);
		return passenger;
	}

	async create(data: Passenger): Promise<Passenger> {
		const company = await this.db.company.findUnique({
			where: { id: data.companyId },
		});
		if (!company)
			throw ResponseHandler.badRequest(
				"No company found against this id: " + data.companyId,
			);
		const passenger = await this.db.passenger.create({
			data: {
				name: data.name.trim(),
				phone_no: data.phoneNo.trim(),
				office_address: data.officeAddress.trim(),
				company_id: data.companyId,
				pick_up_time: data.pickUpTime?.trim(),
				drop_off_time: data.dropOffTime?.trim(),
			},
			include: { company: { select: { id: true, name: true } } },
		});
		return {
			name: passenger.name,
			phoneNo: passenger.phone_no,
			officeAddress: passenger.office_address,
			companyId: passenger.company_id,
			pickUpTime: passenger.pick_up_time ?? undefined,
			dropOffTime: passenger.drop_off_time ?? undefined,
		};
	}

	async update(id: number, data: Passenger): Promise<Passenger> {
		await this.getById(id);
		const passenger = await this.db.passenger.update({
			where: { id },
			data: {
				...(data.name !== undefined && { name: data.name.trim() }),
				...(data.phoneNo !== undefined && { phone_no: data.phoneNo.trim() }),
				...(data.officeAddress !== undefined && {
					office_address: data.officeAddress.trim(),
				}),
				...(data.companyId !== undefined && { company_id: data.companyId }),
				...(data.pickUpTime !== undefined && {
					pick_up_time: data.pickUpTime.trim(),
				}),
				...(data.dropOffTime !== undefined && {
					drop_off_time: data.dropOffTime.trim(),
				}),
			},
		});
		return {
			name: passenger.name,
			phoneNo: passenger.phone_no,
			officeAddress: passenger.office_address,
			companyId: passenger.company_id,
			pickUpTime: passenger.pick_up_time ?? undefined,
			dropOffTime: passenger.drop_off_time ?? undefined,
		};
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.passenger.delete({ where: { id } });
	}
}

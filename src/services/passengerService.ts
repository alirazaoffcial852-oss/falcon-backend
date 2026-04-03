import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { PassengerListQuery, Passenger } from "../types/admin/passenger";
import { buildWhereCondition } from "../utils/buildWhereCondition";
import bcrypt from "bcryptjs";
import { generateRandomNumericPassword } from "../utils/generateRandomPassword";
import { sendCredentialEmail } from "../utils/email";

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
			include: {
				company: { select: { id: true, name: true } },
				user: { select: { email: true } },
			},
		});
		const data = passengers.map((passenger) => {
			return {
				...passenger,
				email: passenger.user?.email ?? null,
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
		const passenger = await this.db.passenger.findUnique({
			where: { id },
			include: { company: true, user: { select: { email: true } } },
		});
		if (!passenger)
			throw ResponseHandler.notFound(
				"No passenger found against this id: " + id,
			);
		return {
			...passenger,
			email: passenger.user?.email ?? null,
		};
	}

	async create(data: Passenger): Promise<Passenger> {
		if (!data.name || !data.phoneNo || !data.officeAddress || !data.companyId) {
			throw ResponseHandler.badRequest("Missing required passenger fields");
		}
		if (
			!data.homeAddress ||
			data.homeLat === undefined ||
			data.homeLong === undefined ||
			data.officeLat === undefined ||
			data.officeLong === undefined
		) {
			throw ResponseHandler.badRequest(
				"homeAddress, homeLat, homeLong, officeLat and officeLong are required",
			);
		}
		const name = data.name;
		const phoneNo = data.phoneNo;
		const homeAddress = data.homeAddress;
		const homeLat = data.homeLat;
		const homeLong = data.homeLong;
		const officeAddress = data.officeAddress;
		const officeLat = data.officeLat;
		const officeLong = data.officeLong;
		const companyId = data.companyId;

		let userId: number | null = null;

		const company = await this.db.company.findUnique({
			where: { id: Number(companyId) },
		});
		if (!company)
			throw ResponseHandler.badRequest(
				"No company found against this id: " + companyId,
			);

		if (data.email) {
			const email = data.email.trim().toLowerCase();
			const existingUser = await this.db.user.findUnique({ where: { email } });
			if (existingUser) {
				throw ResponseHandler.duplicateResource("User", "email");
			}

			const plainPassword = generateRandomNumericPassword(6, 8);
			const hashedPassword = await bcrypt.hash(plainPassword, 10);

			const createdUser = await this.db.user.create({
				data: {
					email: email.trim().toLowerCase(),
					password: hashedPassword,
					role_id: 3,
				},
			});

			userId = createdUser.id;
			await sendCredentialEmail(email, "passenger", plainPassword);
		}

		const passenger = await this.db.passenger.create({
			data: {
				user_id: userId,
				name: name.trim(),
				phone_no: phoneNo.trim(),
				home_address: homeAddress.trim(),
				home_lat: Number(homeLat),
				home_long: Number(homeLong),
				office_address: officeAddress.trim(),
				office_lat: Number(officeLat),
				office_long: Number(officeLong),
				company_id: Number(companyId),
				drop_off_time: data.dropOffTime?.trim(),
				office_pick_up_time: data.officePickUpTime?.trim() || null,
			},
			include: { company: { select: { id: true, name: true } } },
		});

		return {
			name: passenger.name,
			phoneNo: passenger.phone_no,
			homeAddress: passenger.home_address ?? undefined,
			homeLat: passenger.home_lat ?? undefined,
			homeLong: passenger.home_long ?? undefined,
			officeAddress: passenger.office_address,
			officeLat: passenger.office_lat ?? undefined,
			officeLong: passenger.office_long ?? undefined,
			companyId: passenger.company_id,
			pickUpTime: passenger.pick_up_time ?? undefined,
			dropOffTime: passenger.drop_off_time ?? undefined,
			officePickUpTime: passenger.office_pick_up_time ?? undefined,
		};
	}

	async update(id: number, data: Passenger): Promise<Passenger> {
		await this.getById(id);
		const passenger = await this.db.passenger.update({
			where: { id },
			data: {
				...(data.name !== undefined && { name: data.name.trim() }),
				...(data.phoneNo !== undefined && { phone_no: data.phoneNo.trim() }),
				...(data.homeAddress !== undefined && {
					home_address: data.homeAddress.trim(),
				}),
				...(data.homeLat !== undefined && { home_lat: Number(data.homeLat) }),
				...(data.homeLong !== undefined && {
					home_long: Number(data.homeLong),
				}),
				...(data.officeAddress !== undefined && {
					office_address: data.officeAddress.trim(),
				}),
				...(data.officeLat !== undefined && {
					office_lat: Number(data.officeLat),
				}),
				...(data.officeLong !== undefined && {
					office_long: Number(data.officeLong),
				}),
				...(data.companyId !== undefined && { company_id: data.companyId }),
				...(data.pickUpTime !== undefined && {
					pick_up_time: data.pickUpTime.trim(),
				}),
				...(data.dropOffTime !== undefined && {
					drop_off_time: data.dropOffTime.trim(),
				}),
				...(data.officePickUpTime !== undefined && {
					office_pick_up_time: data.officePickUpTime.trim() || null,
				}),
			},
		});
		return {
			name: passenger.name,
			phoneNo: passenger.phone_no,
			homeAddress: passenger.home_address ?? undefined,
			homeLat: passenger.home_lat ?? undefined,
			homeLong: passenger.home_long ?? undefined,
			officeAddress: passenger.office_address,
			officeLat: passenger.office_lat ?? undefined,
			officeLong: passenger.office_long ?? undefined,
			companyId: passenger.company_id,
			pickUpTime: passenger.pick_up_time ?? undefined,
			dropOffTime: passenger.drop_off_time ?? undefined,
			officePickUpTime: passenger.office_pick_up_time ?? undefined,
		};
	}

	async delete(id: number) {
		await this.getById(id);
		await this.db.passenger.delete({ where: { id } });
	}
}

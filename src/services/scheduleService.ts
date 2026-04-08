import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const db = DatabaseService.getInstance().getPrisma();

function parseYmdToLocalDate(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw ResponseHandler.badRequest("Invalid date");
	return new Date(y, m - 1, d);
}

function eachDateInclusive(start: Date, end: Date): Date[] {
	const out: Date[] = [];
	const cur = new Date(start);
	cur.setHours(0, 0, 0, 0);
	const endDay = new Date(end);
	endDay.setHours(0, 0, 0, 0);
	while (cur.getTime() <= endDay.getTime()) {
		out.push(new Date(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return out;
}

export class ScheduleService {
	async listCompanyHolidays(companyId: number) {
		return db.companyHoliday.findMany({
			where: { company_id: companyId },
			orderBy: { date: "asc" },
		});
	}

	async addCompanyHoliday(
		companyId: number,
		dateYmd: string,
		name?: string | null,
	) {
		const date = parseYmdToLocalDate(dateYmd);
		date.setHours(0, 0, 0, 0);
		try {
			return await db.companyHoliday.create({
				data: {
					company_id: companyId,
					date,
					name: name?.trim() || null,
				},
			});
		} catch {
			throw ResponseHandler.duplicateResource("Company holiday", "date");
		}
	}

	async getCompanyHolidayById(id: number) {
		const row = await db.companyHoliday.findUnique({ where: { id } });
		if (!row)
			throw ResponseHandler.notFound("no company holiday found against this id: " + id);
		return row;
	}

	async updateCompanyHoliday(
		id: number,
		data: { date?: string; name?: string | null },
	) {
		await this.getCompanyHolidayById(id);
		const updateData: { date?: Date; name?: string | null } = {};
		if (data.date) {
			const date = parseYmdToLocalDate(data.date);
			date.setHours(0, 0, 0, 0);
			updateData.date = date;
		}
		if (data.name !== undefined) {
			updateData.name = data.name?.trim() || null;
		}
		try {
			return await db.companyHoliday.update({
				where: { id },
				data: updateData,
			});
		} catch {
			throw ResponseHandler.duplicateResource("Company holiday", "date");
		}
	}

	async removeCompanyHoliday(id: number) {
		await this.getCompanyHolidayById(id);
		await db.companyHoliday.delete({ where: { id } });
	}

	async listDriverLeaves(driverId: number, from?: string, to?: string) {
		const where: {
			driver_id: number;
			date?: { gte?: Date; lte?: Date };
		} = { driver_id: driverId };
		if (from || to) {
			where.date = {};
			if (from) {
				const fromDate = parseYmdToLocalDate(from);
				fromDate.setHours(0, 0, 0, 0);
				where.date.gte = fromDate;
			}
			if (to) {
				const toDate = parseYmdToLocalDate(to);
				toDate.setHours(0, 0, 0, 0);
				where.date.lte = toDate;
			}
		}
		return db.driverLeave.findMany({
			where,
			orderBy: { date: "asc" },
		});
	}

	async getDriverIdByUserId(userId: number): Promise<number | null> {
		const d = await db.driver.findUnique({
			where: { user_id: userId },
			select: { id: true },
		});
		return d?.id ?? null;
	}

	async addDriverLeaveRange(
		driverId: number,
		fromYmd: string,
		toYmd: string,
		note?: string | null,
	) {
		const from = parseYmdToLocalDate(fromYmd);
		const to = parseYmdToLocalDate(toYmd);
		from.setHours(0, 0, 0, 0);
		to.setHours(0, 0, 0, 0);
		if (from.getTime() > to.getTime()) {
			throw ResponseHandler.badRequest("from must be before or equal to to");
		}

		const dates = eachDateInclusive(from, to);
		const created: Date[] = [];
		const duplicates: Date[] = [];

		for (const date of dates) {
			try {
				await db.driverLeave.create({
					data: {
						driver_id: driverId,
						date,
						note: note?.trim() || null,
					},
				});
				created.push(date);
			} catch {
				duplicates.push(date);
			}
		}

		return {
			driver_id: driverId,
			from,
			to,
			created_count: created.length,
			duplicate_count: duplicates.length,
			created_dates: created,
			duplicate_dates: duplicates,
		};
	}

	async removeDriverLeave(id: number) {
		const leave = await db.driverLeave.findUnique({ where: { id } });
		if (!leave)
			throw ResponseHandler.notFound("no leave found against this id: " + id);
		await db.driverLeave.deleteMany({ where: { id } });
	}
}

export const scheduleService = new ScheduleService();

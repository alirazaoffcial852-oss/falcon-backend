import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const db = DatabaseService.getInstance().getPrisma();

function parseYmdToLocalDate(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw ResponseHandler.badRequest("Invalid date");
	return new Date(y, m - 1, d);
}

export class ScheduleService {
	async listCompanyHolidays(companyId: number) {
		return db.companyHoliday.findMany({
			where: { company_id: companyId },
			orderBy: { date: "asc" },
		});
	}

	async addCompanyHoliday(companyId: number, dateYmd: string, name?: string | null) {
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

	async removeCompanyHoliday(id: number) {
		await db.companyHoliday.deleteMany({ where: { id } });
	}

	async listDriverLeaves(driverId: number) {
		return db.driverLeave.findMany({
			where: { driver_id: driverId },
			orderBy: { date: "asc" },
		});
	}

	async addDriverLeave(driverId: number, dateYmd: string, note?: string | null) {
		const date = parseYmdToLocalDate(dateYmd);
		date.setHours(0, 0, 0, 0);
		try {
			return await db.driverLeave.create({
				data: {
					driver_id: driverId,
					date,
					note: note?.trim() || null,
				},
			});
		} catch {
			throw ResponseHandler.duplicateResource("Driver leave", "date");
		}
	}

	async removeDriverLeave(id: number) {
		await db.driverLeave.deleteMany({ where: { id } });
	}
}

export const scheduleService = new ScheduleService();

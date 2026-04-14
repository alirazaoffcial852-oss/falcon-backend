import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const db = DatabaseService.getInstance().getPrisma();

function parseYmdToDate(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw ResponseHandler.badRequest("Invalid date");
	return new Date(Date.UTC(y, m - 1, d));
}

type PayrollComponents = Array<"SALARY" | "FUEL">;

export class PayrollService {
	async preview(from: string, to: string, driverId?: number) {
		const fromDate = parseYmdToDate(from);
		const toDate = parseYmdToDate(to);
		if (fromDate.getTime() > toDate.getTime()) {
			throw ResponseHandler.badRequest("from must be before or equal to to");
		}

		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				status: "COMPLETED",
				scheduled_date: { gte: fromDate, lte: toDate },
				...(driverId ? { driver_id: driverId } : {}),
			},
			select: {
				id: true,
				driver_id: true,
				phase: true,
				scheduled_date: true,
				trip_price: true,
				fuel_cost: true,
				salary_payment_status: true,
				fuel_payment_status: true,
			},
			orderBy: [{ driver_id: "asc" }, { scheduled_date: "asc" }, { id: "asc" }],
		});

		const byDriver = new Map<
			number,
			{
				driver_id: number;
				trips_count: number;
				salary_unpaid_total: number;
				fuel_unpaid_total: number;
				salary_paid_total: number;
				fuel_paid_total: number;
			}
		>();

		for (const r of rows) {
			const bucket = byDriver.get(r.driver_id) ?? {
				driver_id: r.driver_id,
				trips_count: 0,
				salary_unpaid_total: 0,
				fuel_unpaid_total: 0,
				salary_paid_total: 0,
				fuel_paid_total: 0,
			};
			bucket.trips_count += 1;
			const salary = Number(r.trip_price ?? 0);
			const fuel = Number(r.fuel_cost ?? 0);
			if (r.salary_payment_status === "UNPAID") {
				bucket.salary_unpaid_total += salary;
			} else {
				bucket.salary_paid_total += salary;
			}
			if (r.fuel_payment_status === "UNPAID") {
				bucket.fuel_unpaid_total += fuel;
			} else {
				bucket.fuel_paid_total += fuel;
			}
			byDriver.set(r.driver_id, bucket);
		}

		const items = [...byDriver.values()];
		return {
			from,
			to,
			driver_id: driverId ?? null,
			summary: {
				drivers_count: items.length,
				trips_count: rows.length,
				salary_unpaid_total: items.reduce((s, x) => s + x.salary_unpaid_total, 0),
				fuel_unpaid_total: items.reduce((s, x) => s + x.fuel_unpaid_total, 0),
				salary_paid_total: items.reduce((s, x) => s + x.salary_paid_total, 0),
				fuel_paid_total: items.reduce((s, x) => s + x.fuel_paid_total, 0),
			},
			items,
		};
	}

	async settle(
		from: string,
		to: string,
		components: PayrollComponents,
		driverId?: number,
	) {
		const fromDate = parseYmdToDate(from);
		const toDate = parseYmdToDate(to);
		if (fromDate.getTime() > toDate.getTime()) {
			throw ResponseHandler.badRequest("from must be before or equal to to");
		}
		const paySalary = components.includes("SALARY");
		const payFuel = components.includes("FUEL");
		if (!paySalary && !payFuel) {
			throw ResponseHandler.badRequest(
				"components must include SALARY and/or FUEL",
			);
		}

		const now = new Date();

		const rows = await db.routeDailyPlanPhaseDriver.findMany({
			where: {
				status: "COMPLETED",
				scheduled_date: { gte: fromDate, lte: toDate },
				...(driverId ? { driver_id: driverId } : {}),
			},
			select: {
				id: true,
				trip_price: true,
				fuel_cost: true,
				salary_payment_status: true,
				fuel_payment_status: true,
			},
		});

		const salaryRows = rows.filter(
			(r) => r.salary_payment_status === "UNPAID" && Number(r.trip_price ?? 0) > 0,
		);
		const fuelRows = rows.filter(
			(r) => r.fuel_payment_status === "UNPAID" && Number(r.fuel_cost ?? 0) > 0,
		);

		if (paySalary && salaryRows.length) {
			await db.routeDailyPlanPhaseDriver.updateMany({
				where: { id: { in: salaryRows.map((x) => x.id) } },
				data: { salary_payment_status: "PAID", salary_paid_at: now },
			});
		}
		if (payFuel && fuelRows.length) {
			await db.routeDailyPlanPhaseDriver.updateMany({
				where: { id: { in: fuelRows.map((x) => x.id) } },
				data: { fuel_payment_status: "PAID", fuel_paid_at: now },
			});
		}

		return {
			from,
			to,
			driver_id: driverId ?? null,
			components,
			paid_at: now,
			salary: {
				rows_marked_paid: paySalary ? salaryRows.length : 0,
				total: paySalary
					? salaryRows.reduce((s, x) => s + Number(x.trip_price ?? 0), 0)
					: 0,
			},
			fuel: {
				rows_marked_paid: payFuel ? fuelRows.length : 0,
				total: payFuel
					? fuelRows.reduce((s, x) => s + Number(x.fuel_cost ?? 0), 0)
					: 0,
			},
		};
	}
}

export const payrollService = new PayrollService();

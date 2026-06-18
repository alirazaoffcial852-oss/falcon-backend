import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const db = DatabaseService.getInstance().getPrisma();

function parseYmdToDate(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw ResponseHandler.badRequest("Invalid date");
	return new Date(Date.UTC(y, m - 1, d));
}

function assertFromToOrder(from: string, to: string): {
	fromDate: Date;
	toDate: Date;
} {
	const fromDate = parseYmdToDate(from);
	const toDate = parseYmdToDate(to);
	if (fromDate.getTime() > toDate.getTime()) {
		throw ResponseHandler.badRequest("from must be before or equal to to");
	}
	return { fromDate, toDate };
}

/** Inclusive calendar-day range for DateTime payment timestamps. */
function paymentTimestampRange(from: string, to: string): { gte: Date; lt: Date } {
	const { fromDate, toDate } = assertFromToOrder(from, to);
	const lt = new Date(toDate);
	lt.setUTCDate(lt.getUTCDate() + 1);
	return { gte: fromDate, lt };
}

type PayrollComponents = Array<"SALARY" | "FUEL">;

type PhaseDriverPayRow = {
	id: number;
	driver_id: number;
	phase: string;
	scheduled_date: Date;
	trip_price: number | null;
	fuel_cost: number | null;
	salary_payment_status: string;
	fuel_payment_status: string;
	salary_paid_at: Date | null;
	fuel_paid_at: Date | null;
	driver: { name: string };
};

type PaymentEventBucket = {
	type: "SALARY" | "FUEL";
	paid_at: Date;
	driver_id: number;
	driver_name: string;
	amount: number;
	trips_count: number;
};

function buildPaymentEvents(rows: PhaseDriverPayRow[]) {
	const events = new Map<string, PaymentEventBucket>();

	const ingest = (
		type: "SALARY" | "FUEL",
		row: PhaseDriverPayRow,
		paidAt: Date,
		amount: number,
	) => {
		if (amount <= 0) return;
		const key = `${type}:${row.driver_id}:${paidAt.toISOString()}`;
		const bucket = events.get(key) ?? {
			type,
			paid_at: paidAt,
			driver_id: row.driver_id,
			driver_name: row.driver.name,
			amount: 0,
			trips_count: 0,
		};
		bucket.amount += amount;
		bucket.trips_count += 1;
		events.set(key, bucket);
	};

	for (const r of rows) {
		if (r.salary_payment_status === "PAID" && r.salary_paid_at != null) {
			ingest("SALARY", r, r.salary_paid_at, Number(r.trip_price ?? 0));
		}
		if (r.fuel_payment_status === "PAID" && r.fuel_paid_at != null) {
			ingest("FUEL", r, r.fuel_paid_at, Number(r.fuel_cost ?? 0));
		}
	}

	const payments = [...events.values()]
		.sort((a, b) => b.paid_at.getTime() - a.paid_at.getTime())
		.map((e) => ({
			type: e.type,
			paid_at: e.paid_at.toISOString(),
			driver_id: e.driver_id,
			driver_name: e.driver_name,
			amount: e.amount,
			trips_count: e.trips_count,
		}));

	const salaryPayments = payments.filter((p) => p.type === "SALARY");
	const fuelPayments = payments.filter((p) => p.type === "FUEL");

	return {
		payments,
		payment_summary: {
			salary_paid_total: salaryPayments.reduce((s, x) => s + x.amount, 0),
			fuel_paid_total: fuelPayments.reduce((s, x) => s + x.amount, 0),
			salary_events: salaryPayments.length,
			fuel_events: fuelPayments.length,
		},
	};
}

export class PayrollService {
	private async loadCompletedPhaseRows(
		from: string,
		to: string,
		driverId: number | undefined,
		mode: "trip" | "paid_at",
	) {
		const { fromDate, toDate } = assertFromToOrder(from, to);
		const paidRange = paymentTimestampRange(from, to);

		if (mode === "trip") {
			return db.routeDailyPlanPhaseDriver.findMany({
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
					salary_paid_at: true,
					fuel_paid_at: true,
					driver: { select: { name: true } },
				},
				orderBy: [{ driver_id: "asc" }, { scheduled_date: "asc" }, { id: "asc" }],
			});
		}

		return db.routeDailyPlanPhaseDriver.findMany({
			where: {
				status: "COMPLETED",
				...(driverId ? { driver_id: driverId } : {}),
				OR: [
					{
						salary_payment_status: "PAID",
						salary_paid_at: paidRange,
					},
					{
						fuel_payment_status: "PAID",
						fuel_paid_at: paidRange,
					},
				],
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
				salary_paid_at: true,
				fuel_paid_at: true,
				driver: { select: { name: true } },
			},
			orderBy: [{ driver_id: "asc" }, { scheduled_date: "asc" }, { id: "asc" }],
		});
	}

	async preview(from: string, to: string, driverId?: number) {
		const rows = await this.loadCompletedPhaseRows(from, to, driverId, "trip");

		const byDriver = new Map<
			number,
			{
				driver_id: number;
				driver_name: string;
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
				driver_name: r.driver.name,
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
		const { payments, payment_summary } = buildPaymentEvents(rows);

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
			payment_summary,
			payments,
		};
	}

	/**
	 * Payment history. Default `dateFilter=trip` (same as preview).
	 * Use `dateFilter=paid_at` to filter by when salary/fuel was marked PAID.
	 */
	async paymentHistory(
		from: string,
		to: string,
		driverId?: number,
		dateFilter: "trip" | "paid_at" = "trip",
	) {
		const rows = await this.loadCompletedPhaseRows(from, to, driverId, dateFilter);
		const { payments, payment_summary } = buildPaymentEvents(rows);

		return {
			from,
			to,
			driver_id: driverId ?? null,
			date_filter: dateFilter,
			summary: payment_summary,
			payments,
		};
	}

	async settle(
		from: string,
		to: string,
		components: PayrollComponents,
		driverId?: number,
	) {
		const { fromDate, toDate } = assertFromToOrder(from, to);
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

	/** Reverse settle: mark PAID salary/fuel back to UNPAID for trips in range. */
	async unsettle(
		from: string,
		to: string,
		components: PayrollComponents,
		driverId?: number,
	) {
		const { fromDate, toDate } = assertFromToOrder(from, to);
		const revertSalary = components.includes("SALARY");
		const revertFuel = components.includes("FUEL");
		if (!revertSalary && !revertFuel) {
			throw ResponseHandler.badRequest(
				"components must include SALARY and/or FUEL",
			);
		}

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
			(r) => r.salary_payment_status === "PAID" && Number(r.trip_price ?? 0) > 0,
		);
		const fuelRows = rows.filter(
			(r) => r.fuel_payment_status === "PAID" && Number(r.fuel_cost ?? 0) > 0,
		);

		if (revertSalary && salaryRows.length) {
			await db.routeDailyPlanPhaseDriver.updateMany({
				where: { id: { in: salaryRows.map((x) => x.id) } },
				data: { salary_payment_status: "UNPAID", salary_paid_at: null },
			});
		}
		if (revertFuel && fuelRows.length) {
			await db.routeDailyPlanPhaseDriver.updateMany({
				where: { id: { in: fuelRows.map((x) => x.id) } },
				data: { fuel_payment_status: "UNPAID", fuel_paid_at: null },
			});
		}

		return {
			from,
			to,
			driver_id: driverId ?? null,
			components,
			salary: {
				rows_reverted: revertSalary ? salaryRows.length : 0,
				total: revertSalary
					? salaryRows.reduce((s, x) => s + Number(x.trip_price ?? 0), 0)
					: 0,
			},
			fuel: {
				rows_reverted: revertFuel ? fuelRows.length : 0,
				total: revertFuel
					? fuelRows.reduce((s, x) => s + Number(x.fuel_cost ?? 0), 0)
					: 0,
			},
		};
	}
}

export const payrollService = new PayrollService();

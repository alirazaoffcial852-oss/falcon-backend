import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import { parseOptionalBoolean } from "../utils/parseOptionalBoolean";

export type CreateExtraRideInput = {
	phaseDriverId: number;
	driverId: number;
	tripPrice: number;
	fuelCost?: number | null;
	markSalaryPaid?: boolean;
	markFuelPaid?: boolean;
	resetPhase?: boolean;
	reason?: string;
	note?: string;
	createdByUserId?: number;
};

export type ExtraRideHistoryQuery = {
	page: number;
	limit: number;
	from?: string;
	to?: string;
	driverId?: number;
	routeDailyPlanId?: number;
	routeId?: number;
};

function formatScheduledDateYmd(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function parseYmdToUtcDate(ymd: string): Date {
	const [y, m, d] = ymd.split("-").map(Number);
	if (!y || !m || !d) throw ResponseHandler.badRequest("Invalid date");
	return new Date(Date.UTC(y, m - 1, d));
}

export class ExtraRideService {
	private db = DatabaseService.getInstance().getPrisma();

	private async assertDriverApproved(driverId: number): Promise<void> {
		const driver = await this.db.driver.findUnique({
			where: { id: driverId },
			select: { id: true, status: true },
		});
		if (!driver) {
			throw ResponseHandler.badRequest("No driver found against this id");
		}
		if (driver.status !== "APPROVED") {
			throw ResponseHandler.badRequest(
				"Cannot assign extra ride to a pending driver",
			);
		}
	}

	async create(input: CreateExtraRideInput) {
		await this.assertDriverApproved(input.driverId);

		const pd = await this.db.routeDailyPlanPhaseDriver.findUnique({
			where: { id: input.phaseDriverId },
			include: {
				route_daily_plan: {
					select: { id: true, definition_route_id: true, status: true },
				},
			},
		});
		if (!pd) {
			throw ResponseHandler.notFound("Phase driver not found");
		}
		if (pd.status === "COMPLETED") {
			throw ResponseHandler.badRequest(
				"Cannot create extra ride on a completed phase",
			);
		}
		if (pd.driver_id === input.driverId) {
			throw ResponseHandler.badRequest(
				"New driver must be different from the current phase driver",
			);
		}

		const leave = await this.db.driverLeave.findUnique({
			where: {
				driver_id_date: {
					driver_id: input.driverId,
					date: pd.scheduled_date,
				},
			},
		});
		if (leave) {
			throw ResponseHandler.badRequest(
				"New driver is on leave on this date",
			);
		}

		const plan = pd.route_daily_plan;
		if (!plan) {
			throw ResponseHandler.badRequest("Daily plan missing for this phase");
		}

		const routeId = plan.definition_route_id;
		const previousDriverId = pd.driver_id;
		const markSalaryPaid = input.markSalaryPaid === true;
		const markFuelPaid = input.markFuelPaid === true;
		const now = new Date();
		const fuelCost =
			input.fuelCost === undefined || input.fuelCost === null
				? null
				: Number(input.fuelCost);

		const shouldReset =
			input.resetPhase === true ||
			pd.status === "ONGOING" ||
			pd.trip_started_at != null;

		const result = await this.db.$transaction(async (tx) => {
			const history = await tx.routeExtraRideHistory.create({
				data: {
					route_id: routeId,
					route_daily_plan_id: pd.route_daily_plan_id,
					phase_driver_id: pd.id,
					phase: pd.phase,
					previous_driver_id: previousDriverId,
					new_driver_id: input.driverId,
					trip_price: input.tripPrice,
					fuel_cost: fuelCost,
					salary_payment_status: markSalaryPaid ? "PAID" : "UNPAID",
					fuel_payment_status: markFuelPaid ? "PAID" : "UNPAID",
					salary_paid_at: markSalaryPaid ? now : null,
					fuel_paid_at: markFuelPaid ? now : null,
					reason: input.reason?.trim() || null,
					note: input.note?.trim() || null,
					created_by_user_id: input.createdByUserId ?? null,
				},
			});

			await tx.routeDailyPlanPhaseDriver.update({
				where: { id: pd.id },
				data: {
					driver_id: input.driverId,
					trip_price: input.tripPrice,
					fuel_cost: fuelCost,
					is_extra_ride: true,
					salary_payment_status: markSalaryPaid ? "PAID" : "UNPAID",
					fuel_payment_status: markFuelPaid ? "PAID" : "UNPAID",
					salary_paid_at: markSalaryPaid ? now : null,
					fuel_paid_at: markFuelPaid ? now : null,
					...(shouldReset
						? {
								status: "PENDING" as const,
								trip_started_at: null,
								selected_car_id: null,
								trip_km: null,
								km_per_liter_snapshot: null,
								fuel_price_per_liter_snapshot: null,
								availability_missed_at: null,
								availability_miss_notified_at: null,
								availability_admin_override_until: null,
								trip_start_reminder_sent_at: null,
							}
						: {}),
				},
			});

			if (shouldReset) {
				const segmentKind =
					pd.phase === "PICKUP" ? "PICKUP_TO_OFFICE" : "DROP_TO_HOMES";
				await tx.routeSegment.updateMany({
					where: {
						route_id: routeId,
						kind: segmentKind,
						status: "ONGOING",
					},
					data: { status: "PENDING" },
				});

				if (pd.phase === "PICKUP") {
					await tx.routeDailyPlan.update({
						where: { id: pd.route_daily_plan_id },
						data: { status: "PENDING", started_at: null },
					});
				}
			}

			return history;
		});

		return this.getHistoryById(result.id);
	}

	private formatHistoryRow(row: {
		id: number;
		route_id: number;
		route_daily_plan_id: number;
		phase_driver_id: number;
		phase: string;
		trip_price: number;
		fuel_cost: number | null;
		salary_payment_status: string;
		fuel_payment_status: string;
		salary_paid_at: Date | null;
		fuel_paid_at: Date | null;
		reason: string | null;
		note: string | null;
		created_by_user_id: number | null;
		created_at: Date;
		route: { id: number; route_name: string };
		route_daily_plan: { id: number; scheduled_date: Date; status: string };
		phase_driver: { id: number; status: string; is_extra_ride: boolean };
		previous_driver: { id: number; name: string; phone_no: string | null };
		new_driver: { id: number; name: string; phone_no: string | null };
	}) {
		return {
			id: row.id,
			route_id: row.route_id,
			route_name: row.route.route_name,
			route_daily_plan_id: row.route_daily_plan_id,
			scheduled_date: formatScheduledDateYmd(row.route_daily_plan.scheduled_date),
			plan_status: row.route_daily_plan.status,
			phase_driver_id: row.phase_driver_id,
			phase_driver_status: row.phase_driver.status,
			is_extra_ride: row.phase_driver.is_extra_ride,
			phase: row.phase,
			previous_driver: row.previous_driver,
			new_driver: row.new_driver,
			trip_price: row.trip_price,
			fuel_cost: row.fuel_cost,
			salary_payment_status: row.salary_payment_status,
			fuel_payment_status: row.fuel_payment_status,
			salary_paid_at: row.salary_paid_at?.toISOString() ?? null,
			fuel_paid_at: row.fuel_paid_at?.toISOString() ?? null,
			reason: row.reason,
			note: row.note,
			created_by_user_id: row.created_by_user_id,
			created_at: row.created_at.toISOString(),
		};
	}

	private historyInclude() {
		return {
			route: { select: { id: true, route_name: true } },
			route_daily_plan: {
				select: { id: true, scheduled_date: true, status: true },
			},
			phase_driver: {
				select: { id: true, status: true, is_extra_ride: true },
			},
			previous_driver: {
				select: { id: true, name: true, phone_no: true },
			},
			new_driver: { select: { id: true, name: true, phone_no: true } },
		} as const;
	}

	async getHistoryById(id: number) {
		const row = await this.db.routeExtraRideHistory.findUnique({
			where: { id },
			include: this.historyInclude(),
		});
		if (!row) throw ResponseHandler.notFound("Extra ride history not found");
		return this.formatHistoryRow(row);
	}

	async listHistory(query: ExtraRideHistoryQuery) {
		const where: {
			route_daily_plan?: { scheduled_date?: { gte?: Date; lte?: Date } };
			OR?: Array<
				| { previous_driver_id: number }
				| { new_driver_id: number }
			>;
			route_daily_plan_id?: number;
			route_id?: number;
		} = {};

		if (query.from || query.to) {
			const scheduledDate: { gte?: Date; lte?: Date } = {};
			if (query.from) {
				scheduledDate.gte = parseYmdToUtcDate(query.from);
			}
			if (query.to) {
				scheduledDate.lte = parseYmdToUtcDate(query.to);
			}
			where.route_daily_plan = { scheduled_date: scheduledDate };
		}
		if (query.driverId !== undefined) {
			where.OR = [
				{ previous_driver_id: query.driverId },
				{ new_driver_id: query.driverId },
			];
		}
		if (query.routeDailyPlanId !== undefined) {
			where.route_daily_plan_id = query.routeDailyPlanId;
		}
		if (query.routeId !== undefined) {
			where.route_id = query.routeId;
		}

		const total = await this.db.routeExtraRideHistory.count({ where });
		const rows = await this.db.routeExtraRideHistory.findMany({
			where,
			orderBy: { created_at: "desc" },
			skip: (query.page - 1) * query.limit,
			take: query.limit,
			include: this.historyInclude(),
		});

		return {
			data: rows.map((row) => this.formatHistoryRow(row)),
			pagination: {
				total,
				page: query.page,
				limit: query.limit,
				total_pages: Math.ceil(total / query.limit),
			},
		};
	}
}

export const extraRideService = new ExtraRideService();

export function normalizeCreateExtraRideBody(
	raw: Record<string, unknown>,
): CreateExtraRideInput {
	const phaseDriverId = Number(raw.phase_driver_id ?? raw.phaseDriverId);
	const driverId = Number(raw.driver_id ?? raw.driverId);
	const tripPrice = Number(raw.trip_price);
	const fuelCostRaw = raw.fuel_cost;
	const fuelCost =
		fuelCostRaw === undefined || fuelCostRaw === null
			? null
			: Number(fuelCostRaw);

	return {
		phaseDriverId,
		driverId,
		tripPrice,
		fuelCost,
		markSalaryPaid:
			parseOptionalBoolean(raw.mark_salary_paid ?? raw.markSalaryPaid) === true,
		markFuelPaid:
			parseOptionalBoolean(raw.mark_fuel_paid ?? raw.markFuelPaid) === true,
		resetPhase:
			parseOptionalBoolean(raw.reset_phase) === true,
		reason: typeof raw.reason === "string" ? raw.reason : undefined,
		note: typeof raw.note === "string" ? raw.note : undefined,
	};
}

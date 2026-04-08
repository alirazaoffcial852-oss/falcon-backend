import { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import { scheduleService } from "../../services/scheduleService";
import type { AuthRequest } from "../../middleware/authMiddleware";

export const ScheduleController = {
	listCompanyHolidays: catchAsync(async (req: Request, res: Response) => {
		const companyId = parseIdParam(req.params.companyId);
		if (companyId === null) throw ResponseHandler.badRequest("Invalid company id");
		const data = await scheduleService.listCompanyHolidays(companyId);
		ResponseHandler.success(res, data, "Company holidays");
	}),

	addCompanyHoliday: catchAsync(async (req: Request, res: Response) => {
		const companyId = parseIdParam(req.params.companyId);
		if (companyId === null) throw ResponseHandler.badRequest("Invalid company id");
		const { date, name } = req.body as { date: string; name?: string };
		const row = await scheduleService.addCompanyHoliday(companyId, date, name);
		ResponseHandler.created(res, row, "Holiday added");
	}),

	getCompanyHolidayById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const data = await scheduleService.getCompanyHolidayById(id);
		ResponseHandler.success(res, data, "Company holiday");
	}),

	updateCompanyHoliday: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const { date, name } = req.body as { date?: string; name?: string | null };
		const data = await scheduleService.updateCompanyHoliday(id, { date, name });
		ResponseHandler.success(res, data, "Holiday updated");
	}),

	removeCompanyHoliday: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await scheduleService.removeCompanyHoliday(id);
		ResponseHandler.success(res, null, "Holiday removed");
	}),

	listDriverLeaves: catchAsync(async (req: AuthRequest, res: Response) => {
		const driverId = parseIdParam(req.params.driverId);
		if (driverId === null) throw ResponseHandler.badRequest("Invalid driver id");
		const from = req.query.from as string | undefined;
		const to = req.query.to as string | undefined;
		const role = String(req.user?.role ?? "");
		if (role === "driver") {
			const userId = req.user?.id ? Number(req.user.id) : 0;
			if (!userId) throw ResponseHandler.unauthorized("Not authenticated");
			const ownDriverId = await scheduleService.getDriverIdByUserId(userId);
			if (!ownDriverId || ownDriverId !== driverId) {
				throw ResponseHandler.forbidden(
					"Drivers can only access their own leave records",
				);
			}
		}
		const data = await scheduleService.listDriverLeaves(driverId, from, to);
		ResponseHandler.success(res, data, "Driver leave days");
	}),

	addDriverLeave: catchAsync(async (req: AuthRequest, res: Response) => {
		const driverId = parseIdParam(req.params.driverId);
		if (driverId === null) throw ResponseHandler.badRequest("Invalid driver id");
		const role = String(req.user?.role ?? "");
		if (role === "driver") {
			const userId = req.user?.id ? Number(req.user.id) : 0;
			if (!userId) throw ResponseHandler.unauthorized("Not authenticated");
			const ownDriverId = await scheduleService.getDriverIdByUserId(userId);
			if (!ownDriverId || ownDriverId !== driverId) {
				throw ResponseHandler.forbidden(
					"Drivers can only add leave for themselves",
				);
			}
		}
		const { from, to, note } = req.body as {
			from: string;
			to: string;
			note?: string;
		};
		const row = await scheduleService.addDriverLeaveRange(
			driverId,
			from,
			to,
			note,
		);
		ResponseHandler.created(res, row, "Driver leave range added");
	}),

	removeDriverLeave: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await scheduleService.removeDriverLeave(id);
		ResponseHandler.success(res, null, "Leave removed");
	}),
};

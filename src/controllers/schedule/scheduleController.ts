import { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import { scheduleService } from "../../services/scheduleService";

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

	removeCompanyHoliday: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await scheduleService.removeCompanyHoliday(id);
		ResponseHandler.success(res, null, "Holiday removed");
	}),

	listDriverLeaves: catchAsync(async (req: Request, res: Response) => {
		const driverId = parseIdParam(req.params.driverId);
		if (driverId === null) throw ResponseHandler.badRequest("Invalid driver id");
		const data = await scheduleService.listDriverLeaves(driverId);
		ResponseHandler.success(res, data, "Driver leave days");
	}),

	addDriverLeave: catchAsync(async (req: Request, res: Response) => {
		const driverId = parseIdParam(req.params.driverId);
		if (driverId === null) throw ResponseHandler.badRequest("Invalid driver id");
		const { date, note } = req.body as { date: string; note?: string };
		const row = await scheduleService.addDriverLeave(driverId, date, note);
		ResponseHandler.created(res, row, "Leave day added");
	}),

	removeDriverLeave: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await scheduleService.removeDriverLeave(id);
		ResponseHandler.success(res, null, "Leave removed");
	}),
};

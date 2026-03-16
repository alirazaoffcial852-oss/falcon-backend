import { Request, Response } from "express";
import { DriverService } from "../../services/driverService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";

const driverService = new DriverService();

export const DriverController = {
	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
		};
		const result = await driverService.list(query);
		ResponseHandler.success(res, result, "Drivers list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const driver = await driverService.getById(id);
		ResponseHandler.success(res, driver, `Driver against id ${id}`);
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const driver = await driverService.create({ ...req.body });
		ResponseHandler.created(res, driver, "Driver created successfully");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");

		const driver = await driverService.update(id, { ...req.body });
		ResponseHandler.success(res, driver, "Driver updated successfully");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await driverService.delete(id);
		ResponseHandler.success(res, null, "Driver deleted");
	}),
};

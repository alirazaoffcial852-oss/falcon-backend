import type { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import { fuelPriceService } from "../../services/fuelPriceService";

export const FuelPriceController = {
	create: catchAsync(async (req: Request, res: Response) => {
		const row = await fuelPriceService.create(req.body);
		ResponseHandler.created(res, row, "Fuel price saved");
	}),

	getCurrent: catchAsync(async (_req: Request, res: Response) => {
		const row = await fuelPriceService.getCurrent();
		ResponseHandler.success(res, row, "Current fuel price");
	}),

	list: catchAsync(async (_req: Request, res: Response) => {
		const rows = await fuelPriceService.list();
		ResponseHandler.success(res, rows, "Fuel price history");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const row = await fuelPriceService.update(id, req.body);
		ResponseHandler.success(res, row, "Fuel price updated");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const deleted = await fuelPriceService.delete(id);
		ResponseHandler.success(res, deleted, "Fuel price deleted");
	}),
};

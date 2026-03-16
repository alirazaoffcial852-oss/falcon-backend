import { Request, Response } from "express";
import { CarService } from "../../services/carService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";

const carService = new CarService();

export const CarController = {
	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
		};
		const result = await carService.list(query);
		ResponseHandler.success(res, result, "Cars list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const car = await carService.getById(id);
		ResponseHandler.success(res, car, `Car against id ${id}`);
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const car = await carService.create({ ...req.body });
		ResponseHandler.created(res, car, "Car created successfully");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");

		const car = await carService.update(id, { ...req.body });
		ResponseHandler.success(res, car, "Car updated successfully");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await carService.delete(id);
		ResponseHandler.success(res, null, "Car deleted");
	}),
};

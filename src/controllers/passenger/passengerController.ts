import { Request, Response } from "express";
import { PassengerService } from "../../services/passengerService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";

const passengerService = new PassengerService();

export const PassengerController = {
	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
			companyId: req.query.companyId
				? parseInt(req.query.companyId as string)
				: undefined,
		};
		const result = await passengerService.list(query);
		ResponseHandler.success(res, result, "Passengers list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const passenger = await passengerService.getById(id);
		ResponseHandler.success(res, passenger, `Passenger against id ${id}`);
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const passenger = await passengerService.create({ ...req.body });
		ResponseHandler.created(res, passenger, "Passenger created successfully");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const passengerId = parseIdParam(req.params.id);
		if (passengerId === null) throw ResponseHandler.badRequest("Invalid id");
		const passenger = await passengerService.update(passengerId, {
			...req.body,
		});
		ResponseHandler.success(res, passenger, `Passenger updated successfully`);
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await passengerService.delete(id);
		ResponseHandler.success(res, null, "Passenger deleted");
	}),
};

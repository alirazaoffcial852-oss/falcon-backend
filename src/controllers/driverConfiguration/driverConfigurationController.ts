import { Request, Response } from "express";
import { DriverConfigurationService } from "../../services/driverConfigurationService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";

const driverConfigurationService = new DriverConfigurationService();

export const DriverConfigurationController = {
	get: catchAsync(async (_req: Request, res: Response) => {
		const config = await driverConfigurationService.get();
		ResponseHandler.success(res, config, "Driver configuration");
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const config = await driverConfigurationService.create(req.body);
		ResponseHandler.created(
			res,
			config,
			"Driver configuration created successfully",
		);
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const config = await driverConfigurationService.update(id, req.body);
		ResponseHandler.success(
			res,
			config,
			"Driver configuration updated successfully",
		);
	}),
};

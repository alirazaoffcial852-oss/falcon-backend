import { Request, Response } from "express";
import { RouteService } from "../../services/routeService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import type { RouteListQuery } from "../../types/admin/route";

const ROUTE_STATUSES = [
	"PENDING",
	"ONGOING",
	"COMPLETED",
	"CANCELLED",
] as const;

function parseStatus(value: unknown): RouteListQuery["status"] {
	if (typeof value !== "string") return undefined;
	return ROUTE_STATUSES.includes(value as (typeof ROUTE_STATUSES)[number])
		? (value as RouteListQuery["status"])
		: undefined;
}

const routeService = new RouteService();

export const RouteController = {
	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
			status: parseStatus(req.query.status),
			companyId: req.query.companyId
				? parseInt(req.query.companyId as string)
				: undefined,
			driverId: req.query.driverId
				? parseInt(req.query.driverId as string)
				: undefined,
		};
		const result = await routeService.list(query);
		ResponseHandler.success(res, result, "Routes list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const route = await routeService.getById(id);
		ResponseHandler.success(res, route, `Route against id ${id}`);
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const route = await routeService.create({ ...req.body });
		ResponseHandler.created(res, route, "Route created successfully");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const route = await routeService.update(id, { ...req.body });
		ResponseHandler.success(res, route, "Route updated successfully");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await routeService.delete(id);
		ResponseHandler.success(res, null, "Route deleted");
	}),
};

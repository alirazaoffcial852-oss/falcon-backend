import type { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import type { AuthRequest } from "../../middleware/authMiddleware";
import {
	extraRideService,
	normalizeCreateExtraRideBody,
} from "../../services/extraRideService";

export const ExtraRideController = {
	create: catchAsync(async (req: Request, res: Response) => {
		const authReq = req as AuthRequest;
		const createdByUserId = authReq.user?.id
			? Number(authReq.user.id)
			: undefined;
		const input = normalizeCreateExtraRideBody(
			req.body as Record<string, unknown>,
		);
		const result = await extraRideService.create({
			...input,
			createdByUserId,
		});
		ResponseHandler.created(res, result, "Extra ride created");
	}),

	listHistory: catchAsync(async (req: Request, res: Response) => {
		const fromRaw =
			(typeof req.query.from === "string" && req.query.from.trim()) ||
			(typeof req.query.date_from === "string" && req.query.date_from.trim()) ||
			undefined;
		const toRaw =
			(typeof req.query.to === "string" && req.query.to.trim()) ||
			(typeof req.query.date_to === "string" && req.query.date_to.trim()) ||
			undefined;
		const driverIdRaw = req.query.driverId ?? req.query.driver_id;
		const driverId =
			driverIdRaw != null && String(driverIdRaw).trim() !== ""
				? parseInt(String(driverIdRaw), 10)
				: undefined;
		if (driverId != null && Number.isNaN(driverId)) {
			throw ResponseHandler.badRequest("Invalid driverId");
		}

		const query = {
			page: Number(req.query.page) || 1,
			limit: Number(req.query.limit) || 20,
			from: fromRaw,
			to: toRaw,
			driverId,
			routeDailyPlanId: req.query.routeDailyPlanId
				? parseInt(String(req.query.routeDailyPlanId), 10)
				: undefined,
			routeId: req.query.routeId
				? parseInt(String(req.query.routeId), 10)
				: undefined,
		};
		const result = await extraRideService.listHistory(query);
		ResponseHandler.success(res, result, "Extra ride history");
	}),
};

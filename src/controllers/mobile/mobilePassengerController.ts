import type { Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { MobilePassengerService } from "../../services/mobile/mobilePassengerService";
import type { AuthRequest } from "../../middleware/authMiddleware";

function getUserId(req: AuthRequest): number {
	const id = req.user?.id;
	if (!id) throw ResponseHandler.unauthorized("Not authenticated");
	return Number(id);
}

export const MobilePassengerController = {
	/** GET /f1/mobile/passenger/session */
	getSession: catchAsync(async (req: AuthRequest, res: Response) => {
		const result = await MobilePassengerService.getSession(getUserId(req));
		ResponseHandler.success(res, result, "Passenger session");
	}),

	/** GET /f1/mobile/passenger/driver/location */
	getDriverLocation: catchAsync(async (req: AuthRequest, res: Response) => {
		const sinceRaw = req.query.since;
		const limitRaw = req.query.limit;
		const since =
			typeof sinceRaw === "string" && sinceRaw.trim().length > 0
				? sinceRaw
				: undefined;
		const limit =
			typeof limitRaw === "string" && limitRaw.trim().length > 0
				? Number(limitRaw)
				: undefined;
		const result = await MobilePassengerService.getDriverLocation(getUserId(req), {
			since,
			limit,
		});
		ResponseHandler.success(res, result, "Driver location");
	}),

	/** POST /f1/mobile/passenger/session/:routeId/ack */
	acknowledgeArrival: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		if (isNaN(routeId)) throw ResponseHandler.badRequest("Invalid routeId");
		const ack = (req.body as { ack?: string }).ack;
		if (!["COMING", "NOT_COMING"].includes(ack ?? "")) {
			throw ResponseHandler.badRequest("ack must be COMING or NOT_COMING");
		}
		const result = await MobilePassengerService.acknowledgeArrival(
			getUserId(req),
			routeId,
			ack as "COMING" | "NOT_COMING",
		);
		ResponseHandler.success(res, result, "Acknowledgement saved");
	}),
};

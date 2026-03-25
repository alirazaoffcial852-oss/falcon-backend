import type { Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { MobileDriverService } from "../../services/mobile/mobileDriverService";
import type { AuthRequest } from "../../middleware/authMiddleware";
import type { LegAction } from "../../types/mobile/driver";

function getUserId(req: AuthRequest): number {
	const id = req.user?.id;
	if (!id) throw ResponseHandler.unauthorized("Not authenticated");
	return Number(id);
}

export const MobileDriverController = {
	/** POST /f1/mobile/driver/available */
	goAvailable: catchAsync(async (req: AuthRequest, res: Response) => {
		const result = await MobileDriverService.goAvailable(getUserId(req));
		ResponseHandler.success(res, result, "Driver is now available");
	}),

	/** GET /f1/mobile/driver/session */
	getSession: catchAsync(async (req: AuthRequest, res: Response) => {
		const result = await MobileDriverService.getSession(getUserId(req));
		ResponseHandler.success(res, result, "Driver session");
	}),

	/** POST /f1/mobile/driver/session/:routeId/start */
	startTrip: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		if (isNaN(routeId)) throw ResponseHandler.badRequest("Invalid routeId");
		const result = await MobileDriverService.startTrip(getUserId(req), routeId);
		ResponseHandler.success(res, result, "Trip started");
	}),

	/** PATCH /f1/mobile/driver/location */
	updateLocation: catchAsync(async (req: AuthRequest, res: Response) => {
		const { lat, long } = req.body as { lat: number; long: number };
		if (typeof lat !== "number" || typeof long !== "number") {
			throw ResponseHandler.badRequest("lat and long are required numbers");
		}
		const result = await MobileDriverService.updateLocation(getUserId(req), lat, long);
		ResponseHandler.success(res, result, "Location updated");
	}),

	/** POST /f1/mobile/driver/session/:routeId/legs/:legId/arrive */
	arriveAtPassenger: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		const legId = parseInt(req.params.legId as string);
		if (isNaN(routeId) || isNaN(legId))
			throw ResponseHandler.badRequest("Invalid routeId or legId");
		const result = await MobileDriverService.arriveAtPassenger(
			getUserId(req),
			routeId,
			legId,
		);
		ResponseHandler.success(res, result, "Arrived at passenger");
	}),

	/** POST /f1/mobile/driver/session/:routeId/legs/:legId/action */
	legAction: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		const legId = parseInt(req.params.legId as string);
		const action = (req.body as { action?: string }).action as LegAction;
		if (!["PICKED", "STILL_WAITING", "MOVE_TO_NEXT"].includes(action)) {
			throw ResponseHandler.badRequest(
				"action must be PICKED, STILL_WAITING, or MOVE_TO_NEXT",
			);
		}
		const result = await MobileDriverService.legAction(
			getUserId(req),
			routeId,
			legId,
			action,
		);
		ResponseHandler.success(res, result, "Action processed");
	}),

	/** POST /f1/mobile/driver/session/:routeId/complete */
	completeTrip: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		if (isNaN(routeId)) throw ResponseHandler.badRequest("Invalid routeId");
		const result = await MobileDriverService.completeTrip(getUserId(req), routeId);
		ResponseHandler.success(res, result, "Ride completed");
	}),
};

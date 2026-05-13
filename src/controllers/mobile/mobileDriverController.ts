import type { Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { MobileDriverService } from "../../services/mobile/mobileDriverService";
import type { AuthRequest } from "../../middleware/authMiddleware";
import type { LegAction } from "../../types/mobile/driver";
import { scheduleService } from "../../services/scheduleService";

function getUserId(req: AuthRequest): number {
	const id = req.user?.id;
	if (!id) throw ResponseHandler.unauthorized("Not authenticated");
	return Number(id);
}

export const MobileDriverController = {
	/** GET /f1/mobile/driver/leaves?from=YYYY-MM-DD&to=YYYY-MM-DD */
	getMyLeaves: catchAsync(async (req: AuthRequest, res: Response) => {
		const userId = getUserId(req);
		const driverId = await scheduleService.getDriverIdByUserId(userId);
		if (!driverId) {
			throw ResponseHandler.notFound("Driver profile not found for this user");
		}
		const from = req.query.from as string | undefined;
		const to = req.query.to as string | undefined;
		if (from && Number.isNaN(new Date(from).getTime())) {
			throw ResponseHandler.badRequest("Invalid from date (YYYY-MM-DD)");
		}
		if (to && Number.isNaN(new Date(to).getTime())) {
			throw ResponseHandler.badRequest("Invalid to date (YYYY-MM-DD)");
		}
		if (from && to && from > to) {
			throw ResponseHandler.badRequest("from must be before or equal to to");
		}
		const result = await scheduleService.listDriverLeaves(driverId, from, to);
		ResponseHandler.success(res, result, "Driver leave days");
	}),

	/** GET /f1/mobile/driver/stats?from=YYYY-MM-DD&to=YYYY-MM-DD */
	getStats: catchAsync(async (req: AuthRequest, res: Response) => {
		const fromStr = req.query.from as string | undefined;
		const toStr = req.query.to as string | undefined;
		const from = fromStr
			? new Date(
					Number(fromStr.slice(0, 4)),
					Number(fromStr.slice(5, 7)) - 1,
					Number(fromStr.slice(8, 10)),
				)
			: undefined;
		const to = toStr
			? new Date(
					Number(toStr.slice(0, 4)),
					Number(toStr.slice(5, 7)) - 1,
					Number(toStr.slice(8, 10)),
				)
			: undefined;
		if (fromStr && Number.isNaN(from?.getTime())) {
			throw ResponseHandler.badRequest("Invalid from date (YYYY-MM-DD)");
		}
		if (toStr && Number.isNaN(to?.getTime())) {
			throw ResponseHandler.badRequest("Invalid to date (YYYY-MM-DD)");
		}
		if (from && to && from.getTime() > to.getTime()) {
			throw ResponseHandler.badRequest("from must be before or equal to to");
		}
		const result = await MobileDriverService.getStats(getUserId(req), from, to);
		ResponseHandler.success(res, result, "Driver stats");
	}),

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

	/** GET /f1/mobile/driver/cars */
	getMyCars: catchAsync(async (req: AuthRequest, res: Response) => {
		const result = await MobileDriverService.getMyCars(getUserId(req));
		ResponseHandler.success(res, result, "Driver cars");
	}),

	/** POST /f1/mobile/driver/session/:phaseDriverId/start — `RouteDailyPlanPhaseDriver.id` (PICKUP or DROP) from GET /session */
	startTrip: catchAsync(async (req: AuthRequest, res: Response) => {
		const phaseDriverId = parseInt(req.params.phaseDriverId as string);
		if (isNaN(phaseDriverId))
			throw ResponseHandler.badRequest("Invalid phaseDriverId");
		const body = req.body as { car_id?: number; carId?: number };
		const chosenCarRaw = body?.car_id ?? body?.carId;
		const chosenCarId = chosenCarRaw == null ? undefined : Number(chosenCarRaw);
		if (chosenCarRaw != null && !Number.isInteger(chosenCarId)) {
			throw ResponseHandler.badRequest("car_id must be an integer");
		}
		const result = await MobileDriverService.startTrip(
			getUserId(req),
			phaseDriverId,
			chosenCarId,
		);
		ResponseHandler.success(
			res,
			result,
			"Trip started for phase driver " + phaseDriverId,
		);
	}),

	/** PATCH /f1/mobile/driver/location */
	updateLocation: catchAsync(async (req: AuthRequest, res: Response) => {
		const { lat, long } = req.body as { lat: number; long: number };
		if (typeof lat !== "number" || typeof long !== "number") {
			throw ResponseHandler.badRequest("lat and long are required numbers");
		}
		const result = await MobileDriverService.updateLocation(
			getUserId(req),
			lat,
			long,
		);
		ResponseHandler.success(res, result, "Location updated");
	}),

	/** POST /f1/mobile/driver/session/phase-passengers/:phasePassengerId/arrive — `phasePassengerId` = RouteDailyPlanPhasePassenger.id from GET /session */
	arriveAtPassenger: catchAsync(async (req: AuthRequest, res: Response) => {
		const phasePassengerId = parseInt(req.params.phasePassengerId as string);
		if (isNaN(phasePassengerId))
			throw ResponseHandler.badRequest("Invalid phasePassengerId");
		const result = await MobileDriverService.arriveAtPassenger(
			getUserId(req),
			phasePassengerId,
		);
		ResponseHandler.success(res, result, "Arrived at passenger");
	}),

	/** POST /f1/mobile/driver/session/phase-passengers/:phasePassengerId/action — body { action } */
	legAction: catchAsync(async (req: AuthRequest, res: Response) => {
		const phasePassengerId = parseInt(req.params.phasePassengerId as string);
		const action = (req.body as { action?: string }).action as LegAction;
		if (isNaN(phasePassengerId))
			throw ResponseHandler.badRequest("Invalid phasePassengerId");
		if (!["PICKED", "STILL_WAITING", "MOVE_TO_NEXT"].includes(action)) {
			throw ResponseHandler.badRequest(
				"action must be PICKED, STILL_WAITING, or MOVE_TO_NEXT",
			);
		}
		const result = await MobileDriverService.legAction(
			getUserId(req),
			phasePassengerId,
			action,
		);
		ResponseHandler.success(res, result, "Action processed");
	}),

	/** POST /f1/mobile/driver/session/phase-passengers/:phasePassengerId/drop — DROP phase only; sets dropped_at */
	dropPassenger: catchAsync(async (req: AuthRequest, res: Response) => {
		const phasePassengerId = parseInt(req.params.phasePassengerId as string);
		if (isNaN(phasePassengerId)) {
			throw ResponseHandler.badRequest("Invalid phasePassengerId");
		}
		const result = await MobileDriverService.dropPassenger(
			getUserId(req),
			phasePassengerId,
		);
		ResponseHandler.success(res, result, "Passenger dropped");
	}),

	/** POST /f1/mobile/driver/session/:routeId/office-checkpoint */
	officeCheckpoint: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		if (isNaN(routeId)) throw ResponseHandler.badRequest("Invalid routeId");
		const result = await MobileDriverService.officeCheckpoint(
			getUserId(req),
			routeId,
		);
		ResponseHandler.success(res, result, "Advanced to next segment");
	}),

	/** POST /f1/mobile/driver/session/:phaseDriverId/complete — `RouteDailyPlanPhaseDriver.id` from GET /session */
	completeTrip: catchAsync(async (req: AuthRequest, res: Response) => {
		const phaseDriverId = parseInt(req.params.phaseDriverId as string);
		if (isNaN(phaseDriverId))
			throw ResponseHandler.badRequest("Invalid phaseDriverId");
		const result = await MobileDriverService.completeTrip(
			getUserId(req),
			phaseDriverId,
		);
		ResponseHandler.success(res, result, "Phase / ride completion processed");
	}),

	/** POST /f1/mobile/driver/session/:routeId/issue-report */
	reportRouteIssue: catchAsync(async (req: AuthRequest, res: Response) => {
		const routeId = parseInt(req.params.routeId as string);
		if (isNaN(routeId)) throw ResponseHandler.badRequest("Invalid routeId");
		const { image_url, note } = req.body as {
			image_url?: string;
			note?: string | null;
		};
		if (!image_url || !String(image_url).trim()) {
			throw ResponseHandler.badRequest("image_url is required");
		}
		const result = await MobileDriverService.reportRouteIssue(
			getUserId(req),
			routeId,
			String(image_url).trim(),
			note == null ? null : String(note),
		);
		ResponseHandler.success(res, result, "Route issue reported");
	}),
};

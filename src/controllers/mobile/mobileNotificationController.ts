import type { Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import type { AuthRequest } from "../../middleware/authMiddleware";
import { notificationService } from "../../services/notificationService";

function getUserId(req: AuthRequest): number {
	const id = req.user?.id;
	if (!id) throw ResponseHandler.unauthorized("Not authenticated");
	return Number(id);
}

export const MobileNotificationController = {
	registerDevice: catchAsync(async (req: AuthRequest, res: Response) => {
		const { deviceToken, platform } = req.body as {
			deviceToken: string;
			platform?: string;
		};
		const result = await notificationService.registerDeviceToken(
			getUserId(req),
			deviceToken,
			platform,
		);
		ResponseHandler.success(res, result, "Device token registered");
	}),

	unregisterDevice: catchAsync(async (req: AuthRequest, res: Response) => {
		const { deviceToken } = req.body as { deviceToken: string };
		const result = await notificationService.unregisterDeviceToken(
			getUserId(req),
			deviceToken,
		);
		ResponseHandler.success(res, result, "Device token unregistered");
	}),

	getHistory: catchAsync(async (req: AuthRequest, res: Response) => {
		const page = parseInt((req.query.page as string) || "1", 10);
		const limit = parseInt((req.query.limit as string) || "20", 10);
		const result = await notificationService.getHistory(
			getUserId(req),
			page,
			limit,
		);
		ResponseHandler.success(res, result, "Notification history");
	}),

	markAsRead: catchAsync(async (req: AuthRequest, res: Response) => {
		const id = parseInt(req.params.id as string, 10);
		if (isNaN(id)) throw ResponseHandler.badRequest("Invalid notification id");
		const result = await notificationService.markAsRead(getUserId(req), id);
		if (!result) throw ResponseHandler.notFound("Notification not found");
		ResponseHandler.success(res, result, "Notification marked as read");
	}),
};

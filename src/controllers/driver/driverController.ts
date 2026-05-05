import { Request, Response } from "express";
import { DriverService } from "../../services/driverService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import type { AuthRequest } from "../../middleware/authMiddleware";

const driverService = new DriverService();

export const DriverController = {
	listCreateRequests: catchAsync(async (req: Request, res: Response) => {
		const status = String(req.query.status ?? "").toUpperCase();
		const normalizedStatus =
			status === "PENDING" || status === "APPROVED"
				? (status as "PENDING" | "APPROVED")
				: undefined;
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			status: normalizedStatus,
		};
		const result = await driverService.listCreateRequests(query);
		ResponseHandler.success(res, result, "Driver create requests");
	}),

	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
		};
		const result = await driverService.list(query);
		ResponseHandler.success(res, result, "Drivers list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const driver = await driverService.getById(id);
		ResponseHandler.success(res, driver, `Driver against id ${id}`);
	}),

	create: catchAsync(async (req: AuthRequest, res: Response) => {
		const requesterRole = String(req.user?.role ?? "");
		const requesterUserId = req.user?.id ? Number(req.user.id) : undefined;
		const result = await driverService.create(
			{ ...req.body },
			{ requesterRole, requesterUserId },
		);
		const isPending =
			typeof result === "object" &&
			result !== null &&
			"request_id" in result;
		if (isPending) {
			return ResponseHandler.success(
				res,
				result,
				"Driver create request submitted for admin approval",
			);
		}
		ResponseHandler.created(res, result, "Driver created successfully");
	}),

	approveCreateRequest: catchAsync(async (req: AuthRequest, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const adminUserId = req.user?.id ? Number(req.user.id) : 0;
		if (!adminUserId) throw ResponseHandler.unauthorized("Not authenticated");
		const { password, confirmPassword } = req.body as {
			password?: string;
			confirmPassword?: string;
		};
		if (!password || !confirmPassword) {
			throw ResponseHandler.badRequest("password and confirmPassword are required");
		}
		const driver = await driverService.approveCreateRequest(
			id,
			adminUserId,
			password,
			confirmPassword,
		);
		ResponseHandler.success(
			res,
			driver,
			"Driver request approved and saved successfully",
		);
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");

		const driver = await driverService.update(id, { ...req.body });
		ResponseHandler.success(res, driver, "Driver updated successfully");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await driverService.delete(id);
		ResponseHandler.success(res, null, "Driver deleted");
	}),
};

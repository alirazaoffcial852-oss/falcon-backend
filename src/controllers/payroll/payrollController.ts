import type { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { payrollService } from "../../services/payrollService";

export const PayrollController = {
	preview: catchAsync(async (req: Request, res: Response) => {
		const from = String(req.query.from ?? "");
		const to = String(req.query.to ?? "");
		const driverIdRaw = req.query.driverId as string | undefined;
		const driverId =
			driverIdRaw && driverIdRaw.trim() !== "" ? Number(driverIdRaw) : undefined;
		const result = await payrollService.preview(from, to, driverId);
		ResponseHandler.success(res, result, "Payroll preview");
	}),

	settle: catchAsync(async (req: Request, res: Response) => {
		const body = req.body as {
			from: string;
			to: string;
			driver_id?: number;
			components: Array<"SALARY" | "FUEL">;
		};
		const result = await payrollService.settle(
			body.from,
			body.to,
			body.components,
			body.driver_id,
		);
		ResponseHandler.success(res, result, "Payroll settled");
	}),
};

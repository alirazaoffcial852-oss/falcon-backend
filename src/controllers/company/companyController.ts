import { Request, Response } from "express";
import { CompanyService } from "../../services/companyService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";

const companyService = new CompanyService();

export const CompanyController = {
	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: parseInt(req.query.page as string) || 1,
			limit: parseInt(req.query.limit as string) || 20,
			search: (req.query.search as string) || "",
		};
		const result = await companyService.list(query);
		ResponseHandler.success(res, result, "Companies list");
	}),

	getById: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const company = await companyService.getById(id);
		ResponseHandler.success(res, company, `Company against id ${id}`);
	}),

	create: catchAsync(async (req: Request, res: Response) => {
		const company = await companyService.create({
			...req.body,
		});
		ResponseHandler.created(res, company, "Company created successfully");
	}),

	update: catchAsync(async (req: Request, res: Response) => {
		const companyId = parseIdParam(req.params.id);
		if (companyId === null) throw ResponseHandler.badRequest("Invalid id");
		const company = await companyService.update(companyId, { ...req.body });
		ResponseHandler.success(res, company, "Company updated successfully");
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await companyService.delete(id);
		ResponseHandler.success(res, null, "Company deleted");
	}),
};

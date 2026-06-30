import { Request, Response } from "express";
import { RouteService } from "../../services/routeService";
import { routeHistoryService } from "../../services/routeHistoryService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { parseIdParam } from "../../utils/parseId";
import { parseOptionalBoolean } from "../../utils/parseOptionalBoolean";
const routeService = new RouteService();

export const RouteController = {
	/** GET /routes/history — daily route report (default today). Query: date, companyId, driverId */
	getHistoryReport: catchAsync(async (req: Request, res: Response) => {
		const date =
			typeof req.query.date === "string" ? req.query.date : undefined;
		const companyIdRaw = req.query.companyId;
		const driverIdRaw = req.query.driverId;
		const companyId =
			companyIdRaw != null && String(companyIdRaw).trim() !== ""
				? parseInt(String(companyIdRaw), 10)
				: undefined;
		const driverId =
			driverIdRaw != null && String(driverIdRaw).trim() !== ""
				? parseInt(String(driverIdRaw), 10)
				: undefined;
		if (companyId != null && Number.isNaN(companyId)) {
			throw ResponseHandler.badRequest("Invalid companyId");
		}
		if (driverId != null && Number.isNaN(driverId)) {
			throw ResponseHandler.badRequest("Invalid driverId");
		}
		const result = await routeHistoryService.getDailyRouteHistoryReport({
			date,
			companyId,
			driverId,
		});
		ResponseHandler.success(res, result, "Route history report");
	}),

	list: catchAsync(async (req: Request, res: Response) => {
		const query = {
			page: Number(req.query.page) || 1,
			limit: Number(req.query.limit) || 20,
			search: (req.query.search as string) || "",
			companyId: req.query.companyId
				? parseInt(String(req.query.companyId), 10)
				: undefined,
			driverId: req.query.driverId
				? parseInt(String(req.query.driverId), 10)
				: undefined,
			status: req.query.status as
				| "PENDING"
				| "ONGOING"
				| "COMPLETED"
				| undefined,
			is_active: parseOptionalBoolean(req.query.is_active),
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
		const result = await routeService.update(id, { ...req.body });
		ResponseHandler.success(res, result, "Route updated");
	}),

	setActiveStatus: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const { is_active } = req.body as { is_active: boolean };
		const route = await routeService.setActive(id, is_active);
		const message = is_active ? "Route activated" : "Route deactivated";
		ResponseHandler.success(res, route, message);
	}),

	optimize: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const route = await routeService.optimizeById(id);
		ResponseHandler.success(
			res,
			route,
			"Route optimized and directions saved successfully",
		);
	}),

	delete: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		await routeService.delete(id);
		ResponseHandler.success(res, null, "Route deleted");
	}),

	/** Spawn daily instances from all templates (skip holidays / leave / duplicates). */
	generateDaily: catchAsync(async (req: Request, res: Response) => {
		const body = req.body as {
			date?: string;
			plannedOnly?: boolean;
		};
		const raw = body?.date;
		const day = raw
			? new Date(
					Number(raw.slice(0, 4)),
					Number(raw.slice(5, 7)) - 1,
					Number(raw.slice(8, 10)),
				)
			: new Date();
		const result = await routeService.generateDailyInstancesForDate(day, {
			plannedOnly: body?.plannedOnly === true,
		});
		ResponseHandler.success(res, result, "Daily route generation finished");
	}),

	/** Preview which routes can be generated and why others will be skipped. */
	generateDailyPreview: catchAsync(async (req: Request, res: Response) => {
		const raw = req.query.date as string | undefined;
		const day = raw
			? new Date(
					Number(raw.slice(0, 4)),
					Number(raw.slice(5, 7)) - 1,
					Number(raw.slice(8, 10)),
				)
			: new Date();
		const plannedOnlyRaw = req.query.plannedOnly as string | undefined;
		const plannedOnly = plannedOnlyRaw === "true" || plannedOnlyRaw === "1";
		const result = await routeService.previewDailyGeneration(day, {
			plannedOnly,
		});
		ResponseHandler.success(res, result, "Daily route generation preview");
	}),

	/** Per-day passenger counts for spawned instances (template id = master route). */
	getTemplatePlanStats: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const fromStr = req.query.from as string;
		const toStr = req.query.to as string;
		const from = new Date(
			Number(fromStr.slice(0, 4)),
			Number(fromStr.slice(5, 7)) - 1,
			Number(fromStr.slice(8, 10)),
		);
		const to = new Date(
			Number(toStr.slice(0, 4)),
			Number(toStr.slice(5, 7)) - 1,
			Number(toStr.slice(8, 10)),
		);
		const stats = await routeService.getTemplatePlanStats(id, from, to);
		ResponseHandler.success(res, stats, "Template plan stats");
	}),

	/** POST /routes/phase-drivers/:phaseDriverId/reassign-driver */
	reassignPhaseDriver: catchAsync(async (req: Request, res: Response) => {
		const phaseDriverId = parseIdParam(req.params.phaseDriverId);
		if (phaseDriverId === null) {
			throw ResponseHandler.badRequest("Invalid phaseDriverId");
		}
		const body = req.body as {
			driver_id?: number;
			driverId?: number;
			reset_phase?: boolean;
		};
		const newDriverId = body.driver_id ?? body.driverId;
		if (!newDriverId) {
			throw ResponseHandler.badRequest("driver_id is required");
		}
		const result = await routeService.reassignPhaseDriver(
			phaseDriverId,
			newDriverId,
			body.reset_phase,
		);
		ResponseHandler.success(res, result, "Phase driver reassigned");
	}),

	/** Create one instance from a template for a calendar day. */
	spawnFromTemplate: catchAsync(async (req: Request, res: Response) => {
		const id = parseIdParam(req.params.id);
		if (id === null) throw ResponseHandler.badRequest("Invalid id");
		const raw = (req.body as { date?: string })?.date;
		const day = raw
			? new Date(
					Number(raw.slice(0, 4)),
					Number(raw.slice(5, 7)) - 1,
					Number(raw.slice(8, 10)),
				)
			: new Date();
		const route = await routeService.cloneTemplateToInstance(id, day);
		ResponseHandler.created(res, route, "Daily instance created");
	}),
};

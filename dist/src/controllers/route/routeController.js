"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteController = void 0;
const routeService_1 = require("../../services/routeService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const routeService = new routeService_1.RouteService();
exports.RouteController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
            companyId: req.query.companyId
                ? parseInt(req.query.companyId)
                : undefined,
            driverId: req.query.driverId
                ? parseInt(req.query.driverId)
                : undefined,
        };
        const result = await routeService.list(query);
        ResponseHandler_1.ResponseHandler.success(res, result, "Routes list");
    }),
    getById: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const route = await routeService.getById(id);
        ResponseHandler_1.ResponseHandler.success(res, route, `Route against id ${id}`);
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const route = await routeService.create({ ...req.body });
        ResponseHandler_1.ResponseHandler.created(res, route, "Route created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const route = await routeService.update(id, { ...req.body });
        ResponseHandler_1.ResponseHandler.success(res, route, "Route updated successfully");
    }),
    optimize: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const route = await routeService.optimizeById(id);
        ResponseHandler_1.ResponseHandler.success(res, route, "Route optimized and directions saved successfully");
    }),
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await routeService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Route deleted");
    }),
    /** Spawn daily instances from all templates (skip holidays / leave / duplicates). */
    generateDaily: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const body = req.body;
        const raw = body?.date;
        const day = raw
            ? new Date(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, Number(raw.slice(8, 10)))
            : new Date();
        const result = await routeService.generateDailyInstancesForDate(day, {
            plannedOnly: body?.plannedOnly === true,
        });
        ResponseHandler_1.ResponseHandler.success(res, result, "Daily route generation finished");
    }),
    /** Per-day passenger counts for spawned instances (template id = master route). */
    getTemplatePlanStats: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const fromStr = req.query.from;
        const toStr = req.query.to;
        const from = new Date(Number(fromStr.slice(0, 4)), Number(fromStr.slice(5, 7)) - 1, Number(fromStr.slice(8, 10)));
        const to = new Date(Number(toStr.slice(0, 4)), Number(toStr.slice(5, 7)) - 1, Number(toStr.slice(8, 10)));
        const stats = await routeService.getTemplatePlanStats(id, from, to);
        ResponseHandler_1.ResponseHandler.success(res, stats, "Template plan stats");
    }),
    /** Create one instance from a template for a calendar day. */
    spawnFromTemplate: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const raw = req.body?.date;
        const day = raw
            ? new Date(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, Number(raw.slice(8, 10)))
            : new Date();
        const route = await routeService.cloneTemplateToInstance(id, day);
        ResponseHandler_1.ResponseHandler.created(res, route, "Daily instance created");
    }),
};

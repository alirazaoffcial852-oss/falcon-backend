"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteController = void 0;
const routeService_1 = require("../../services/routeService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const ROUTE_STATUSES = [
    "PENDING",
    "ONGOING",
    "COMPLETED",
    "CANCELLED",
];
function parseStatus(value) {
    if (typeof value !== "string")
        return undefined;
    return ROUTE_STATUSES.includes(value)
        ? value
        : undefined;
}
const routeService = new routeService_1.RouteService();
exports.RouteController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
            status: parseStatus(req.query.status),
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
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await routeService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Route deleted");
    }),
};

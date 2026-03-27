"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverController = void 0;
const driverService_1 = require("../../services/driverService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const driverService = new driverService_1.DriverService();
exports.DriverController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
        };
        const result = await driverService.list(query);
        ResponseHandler_1.ResponseHandler.success(res, result, "Drivers list");
    }),
    getById: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const driver = await driverService.getById(id);
        ResponseHandler_1.ResponseHandler.success(res, driver, `Driver against id ${id}`);
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const driver = await driverService.create({ ...req.body });
        ResponseHandler_1.ResponseHandler.created(res, driver, "Driver created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const driver = await driverService.update(id, { ...req.body });
        ResponseHandler_1.ResponseHandler.success(res, driver, "Driver updated successfully");
    }),
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await driverService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Driver deleted");
    }),
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverConfigurationController = void 0;
const driverConfigurationService_1 = require("../../services/driverConfigurationService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const driverConfigurationService = new driverConfigurationService_1.DriverConfigurationService();
exports.DriverConfigurationController = {
    get: (0, catchAsync_1.catchAsync)(async (_req, res) => {
        const config = await driverConfigurationService.get();
        ResponseHandler_1.ResponseHandler.success(res, config, "Driver configuration");
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const config = await driverConfigurationService.create(req.body);
        ResponseHandler_1.ResponseHandler.created(res, config, "Driver configuration created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const config = await driverConfigurationService.update(id, req.body);
        ResponseHandler_1.ResponseHandler.success(res, config, "Driver configuration updated successfully");
    }),
};

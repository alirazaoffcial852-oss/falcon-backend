"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobilePassengerController = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const mobilePassengerService_1 = require("../../services/mobile/mobilePassengerService");
function getUserId(req) {
    const id = req.user?.id;
    if (!id)
        throw ResponseHandler_1.ResponseHandler.unauthorized("Not authenticated");
    return Number(id);
}
exports.MobilePassengerController = {
    /** GET /f1/mobile/passenger/session */
    getSession: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const result = await mobilePassengerService_1.MobilePassengerService.getSession(getUserId(req));
        ResponseHandler_1.ResponseHandler.success(res, result, "Passenger session");
    }),
    /** GET /f1/mobile/passenger/driver/location */
    getDriverLocation: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const result = await mobilePassengerService_1.MobilePassengerService.getDriverLocation(getUserId(req));
        ResponseHandler_1.ResponseHandler.success(res, result, "Driver location");
    }),
    /** POST /f1/mobile/passenger/session/:routeId/ack */
    acknowledgeArrival: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const routeId = parseInt(req.params.routeId);
        if (isNaN(routeId))
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid routeId");
        const ack = req.body.ack;
        if (!["COMING", "NOT_COMING"].includes(ack ?? "")) {
            throw ResponseHandler_1.ResponseHandler.badRequest("ack must be COMING or NOT_COMING");
        }
        const result = await mobilePassengerService_1.MobilePassengerService.acknowledgeArrival(getUserId(req), routeId, ack);
        ResponseHandler_1.ResponseHandler.success(res, result, "Acknowledgement saved");
    }),
};

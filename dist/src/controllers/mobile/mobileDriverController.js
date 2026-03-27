"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileDriverController = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const mobileDriverService_1 = require("../../services/mobile/mobileDriverService");
function getUserId(req) {
    const id = req.user?.id;
    if (!id)
        throw ResponseHandler_1.ResponseHandler.unauthorized("Not authenticated");
    return Number(id);
}
exports.MobileDriverController = {
    /** POST /f1/mobile/driver/available */
    goAvailable: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const result = await mobileDriverService_1.MobileDriverService.goAvailable(getUserId(req));
        ResponseHandler_1.ResponseHandler.success(res, result, "Driver is now available");
    }),
    /** GET /f1/mobile/driver/session */
    getSession: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const result = await mobileDriverService_1.MobileDriverService.getSession(getUserId(req));
        ResponseHandler_1.ResponseHandler.success(res, result, "Driver session");
    }),
    /** POST /f1/mobile/driver/session/:routeId/start */
    startTrip: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const routeId = parseInt(req.params.routeId);
        if (isNaN(routeId))
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid routeId");
        const result = await mobileDriverService_1.MobileDriverService.startTrip(getUserId(req), routeId);
        ResponseHandler_1.ResponseHandler.success(res, result, "Trip started");
    }),
    /** PATCH /f1/mobile/driver/location */
    updateLocation: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { lat, long } = req.body;
        if (typeof lat !== "number" || typeof long !== "number") {
            throw ResponseHandler_1.ResponseHandler.badRequest("lat and long are required numbers");
        }
        const result = await mobileDriverService_1.MobileDriverService.updateLocation(getUserId(req), lat, long);
        ResponseHandler_1.ResponseHandler.success(res, result, "Location updated");
    }),
    /** POST /f1/mobile/driver/session/:routeId/legs/:legId/arrive */
    arriveAtPassenger: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const routeId = parseInt(req.params.routeId);
        const legId = parseInt(req.params.legId);
        if (isNaN(routeId) || isNaN(legId))
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid routeId or legId");
        const result = await mobileDriverService_1.MobileDriverService.arriveAtPassenger(getUserId(req), routeId, legId);
        ResponseHandler_1.ResponseHandler.success(res, result, "Arrived at passenger");
    }),
    /** POST /f1/mobile/driver/session/:routeId/legs/:legId/action */
    legAction: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const routeId = parseInt(req.params.routeId);
        const legId = parseInt(req.params.legId);
        const action = req.body.action;
        if (!["PICKED", "STILL_WAITING", "MOVE_TO_NEXT"].includes(action)) {
            throw ResponseHandler_1.ResponseHandler.badRequest("action must be PICKED, STILL_WAITING, or MOVE_TO_NEXT");
        }
        const result = await mobileDriverService_1.MobileDriverService.legAction(getUserId(req), routeId, legId, action);
        ResponseHandler_1.ResponseHandler.success(res, result, "Action processed");
    }),
    /** POST /f1/mobile/driver/session/:routeId/complete */
    completeTrip: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const routeId = parseInt(req.params.routeId);
        if (isNaN(routeId))
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid routeId");
        const result = await mobileDriverService_1.MobileDriverService.completeTrip(getUserId(req), routeId);
        ResponseHandler_1.ResponseHandler.success(res, result, "Ride completed");
    }),
};

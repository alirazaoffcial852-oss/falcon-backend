"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassengerController = void 0;
const passengerService_1 = require("../../services/passengerService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const passengerService = new passengerService_1.PassengerService();
exports.PassengerController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
            companyId: req.query.companyId
                ? parseInt(req.query.companyId)
                : undefined,
        };
        const result = await passengerService.list(query);
        ResponseHandler_1.ResponseHandler.success(res, result, "Passengers list");
    }),
    getById: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const passenger = await passengerService.getById(id);
        ResponseHandler_1.ResponseHandler.success(res, passenger, `Passenger against id ${id}`);
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const passenger = await passengerService.create({ ...req.body });
        ResponseHandler_1.ResponseHandler.created(res, passenger, "Passenger created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const passengerId = (0, parseId_1.parseIdParam)(req.params.id);
        if (passengerId === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const passenger = await passengerService.update(passengerId, {
            ...req.body,
        });
        ResponseHandler_1.ResponseHandler.success(res, passenger, `Passenger updated successfully`);
    }),
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await passengerService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Passenger deleted");
    }),
};

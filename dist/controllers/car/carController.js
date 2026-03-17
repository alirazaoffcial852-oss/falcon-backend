"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CarController = void 0;
const carService_1 = require("../../services/carService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const parseId_1 = require("../../utils/parseId");
const carService = new carService_1.CarService();
exports.CarController = {
    list: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const query = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 20,
            search: req.query.search || "",
        };
        const result = await carService.list(query);
        ResponseHandler_1.ResponseHandler.success(res, result, "Cars list");
    }),
    getById: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const car = await carService.getById(id);
        ResponseHandler_1.ResponseHandler.success(res, car, `Car against id ${id}`);
    }),
    create: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const car = await carService.create({ ...req.body });
        ResponseHandler_1.ResponseHandler.created(res, car, "Car created successfully");
    }),
    update: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        const car = await carService.update(id, { ...req.body });
        ResponseHandler_1.ResponseHandler.success(res, car, "Car updated successfully");
    }),
    delete: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const id = (0, parseId_1.parseIdParam)(req.params.id);
        if (id === null)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid id");
        await carService.delete(id);
        ResponseHandler_1.ResponseHandler.success(res, null, "Car deleted");
    }),
};

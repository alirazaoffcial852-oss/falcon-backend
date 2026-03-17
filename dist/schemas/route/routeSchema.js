"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeIdParamSchema = exports.listRoutesQuerySchema = exports.updateRouteSchema = exports.createRouteSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const routeStatusValues = [
    "PENDING",
    "ONGOING",
    "COMPLETED",
    "CANCELLED",
];
const routeLegSchema = joi_1.default.object({
    passengerId: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Passenger id is required",
        "number.min": "Passenger id must be greater than 0",
    }),
    pickupAddress: joi_1.default.string().trim().required().messages({
        "any.required": "Pickup address is required",
        "string.empty": "Pickup address is required",
    }),
    pickupLat: joi_1.default.number().required().messages({
        "any.required": "Pickup latitude is required",
        "number.base": "Pickup latitude must be a number",
    }),
    pickupLong: joi_1.default.number().required().messages({
        "any.required": "Pickup longitude is required",
        "number.base": "Pickup longitude must be a number",
    }),
    pickupTime: joi_1.default.string().trim().required().messages({
        "any.required": "Pickup time is required",
        "string.empty": "Pickup time is required",
    }),
    dropoffAddress: joi_1.default.string().trim().required().messages({
        "any.required": "Dropoff address is required",
        "string.empty": "Dropoff address is required",
    }),
    dropoffLat: joi_1.default.number().required().messages({
        "any.required": "Dropoff latitude is required",
        "number.base": "Dropoff latitude must be a number",
    }),
    dropoffLong: joi_1.default.number().required().messages({
        "any.required": "Dropoff longitude is required",
        "number.base": "Dropoff longitude must be a number",
    }),
    dropoffTime: joi_1.default.string().trim().required().messages({
        "any.required": "Dropoff time is required",
        "string.empty": "Dropoff time is required",
    }),
    tollAmount: joi_1.default.number().allow(null).messages({
        "number.base": "Toll amount must be a number",
    }),
});
exports.createRouteSchema = joi_1.default.object({
    companyId: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Company id is required",
        "number.min": "Company id must be greater than 0",
    }),
    driverId: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Driver id is required",
        "number.min": "Driver id must be greater than 0",
    }),
    officeAddress: joi_1.default.string().trim().required().messages({
        "any.required": "Office address is required",
        "string.empty": "Office address is required",
    }),
    officeLat: joi_1.default.number().required().messages({
        "any.required": "Office latitude is required",
        "number.base": "Office latitude must be a number",
    }),
    officeLong: joi_1.default.number().required().messages({
        "any.required": "Office longitude is required",
        "number.base": "Office longitude must be a number",
    }),
    legs: joi_1.default.array().items(routeLegSchema).min(1).required().messages({
        "any.required": "At least one leg is required",
        "array.min": "At least one leg is required",
    }),
}).required();
exports.updateRouteSchema = joi_1.default.object({
    companyId: joi_1.default.number().integer().min(1).messages({
        "number.min": "Company id must be greater than 0",
    }),
    driverId: joi_1.default.number().integer().min(1).messages({
        "number.min": "Driver id must be greater than 0",
    }),
    officeAddress: joi_1.default.string().trim().messages({
        "string.trim": "Office address must be a string",
    }),
    officeLat: joi_1.default.number().messages({
        "number.base": "Office latitude must be a number",
    }),
    officeLong: joi_1.default.number().messages({
        "number.base": "Office longitude must be a number",
    }),
    legs: joi_1.default.array().items(routeLegSchema).min(1).messages({
        "array.min": "At least one leg is required",
    }),
}).min(1);
exports.listRoutesQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    search: joi_1.default.string().trim().allow("").default(""),
    status: joi_1.default.string()
        .valid(...routeStatusValues)
        .optional(),
    companyId: joi_1.default.string()
        .pattern(/^[1-9]\d*$/)
        .allow(""),
    driverId: joi_1.default.string()
        .pattern(/^[1-9]\d*$/)
        .allow(""),
});
exports.routeIdParamSchema = joi_1.default.object({
    id: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Route id is required",
        "number.min": "Route id must be greater than 0",
    }),
});

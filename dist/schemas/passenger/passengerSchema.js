"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passengerIdParamSchema = exports.listPassengersQuerySchema = exports.updatePassengerSchema = exports.createPassengerSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createPassengerSchema = joi_1.default.object({
    name: joi_1.default.string().trim().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name is required",
        "string.trim": "Name must be a string",
    }),
    phoneNo: joi_1.default.string().trim().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number is required",
        "string.trim": "Phone number must be a string",
    }),
    officeAddress: joi_1.default.string().trim().required().messages({
        "any.required": "Office address is required",
        "string.empty": "Office address is required",
        "string.trim": "Office address must be a string",
    }),
    companyId: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Company id is required",
        "number.min": "Company id must be greater than 0",
    }),
    pickUpTime: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Pick up time must be a string",
    }),
    dropOffTime: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Drop off time must be a string",
    }),
}).required();
exports.updatePassengerSchema = joi_1.default.object({
    name: joi_1.default.string().trim().messages({
        "string.trim": "Name must be a string",
    }),
    phoneNo: joi_1.default.string().trim().messages({
        "string.trim": "Phone number must be a string",
    }),
    officeAddress: joi_1.default.string().trim().messages({
        "string.trim": "Office address must be a string",
    }),
    companyId: joi_1.default.number().integer().min(1).messages({
        "number.min": "Company id must be greater than 0",
    }),
    pickUpTime: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Pick up time must be a string",
    }),
    dropOffTime: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Drop off time must be a string",
    }),
}).min(1);
exports.listPassengersQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    search: joi_1.default.string().trim().allow(""),
    companyId: joi_1.default.string()
        .pattern(/^[1-9]\d*$/)
        .allow(""),
});
exports.passengerIdParamSchema = joi_1.default.object({
    id: joi_1.default.number().integer().required().messages({
        "any.required": "Passenger id is required",
        "number.base": "Passenger id must be a number",
        "number.integer": "Passenger id must be an integer",
    }),
});

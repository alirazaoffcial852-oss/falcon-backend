"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverIdParamSchema = exports.listDriversQuerySchema = exports.updateDriverSchema = exports.createDriverSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createDriverSchema = joi_1.default.object({
    name: joi_1.default.string().trim().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name is required",
        "string.trim": "Name must be a string",
    }),
    phone_no: joi_1.default.string().trim().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number is required",
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().required().messages({
        "any.required": "Address is required",
        "string.empty": "Address is required",
        "string.trim": "Address must be a string",
    }),
    emergency_phone_no: joi_1.default.string().trim().required().messages({
        "any.required": "Emergency phone number is required",
        "string.empty": "Emergency phone number is required",
        "string.trim": "Emergency phone number must be a string",
    }),
    driver_image_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver image url must be a string",
    }),
    rate_per_km: joi_1.default.number().allow(null).messages({
        "number.base": "Rate per km must be a number",
    }),
    driver_cnic_front_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver cnic front url must be a string",
    }),
    driver_cnic_back_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver cnic back url must be a string",
    }),
    driver_license_front_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver license front url must be a string",
    }),
    driver_license_back_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver license back url must be a string",
    }),
    salary: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Salary must be a string",
    }),
    car_id: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Car id is required",
        "number.min": "Car id must be greater than 0",
    }),
}).required();
exports.updateDriverSchema = joi_1.default.object({
    name: joi_1.default.string().trim().required().messages({
        "any.required": "Name is required",
        "string.trim": "Name must be a string",
    }),
    phone_no: joi_1.default.string().trim().required().messages({
        "any.required": "Phone number is required",
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().required().messages({
        "any.required": "Address is required",
        "string.trim": "Address must be a string",
    }),
    emergency_phone_no: joi_1.default.string().trim().required().messages({
        "any.required": "Emergency phone number is required",
        "string.trim": "Emergency phone number must be a string",
    }),
    driver_image_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver image url must be a string",
    }),
    rate_per_km: joi_1.default.number().required().messages({
        "any.required": "Rate per km is required",
        "number.base": "Rate per km must be a number",
    }),
    driver_cnic_front_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver cnic front url must be a string",
    }),
    driver_cnic_back_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver cnic back url must be a string",
    }),
    driver_license_front_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver license front url must be a string",
    }),
    driver_license_back_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Driver license back url must be a string",
    }),
    salary: joi_1.default.string().trim().required().messages({
        "string.trim": "Salary must be a string",
    }),
    car_id: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Car id is required",
    }),
}).min(1);
exports.listDriversQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    search: joi_1.default.string().trim().allow("").default(""),
});
exports.driverIdParamSchema = joi_1.default.object({
    id: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Id is required",
        "number.min": "Id must be greater than 0",
    }),
});

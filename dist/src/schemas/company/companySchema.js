"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyIdParamSchema = exports.listCompaniesQuerySchema = exports.updateCompanySchema = exports.createCompanySchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createCompanySchema = joi_1.default.object({
    name: joi_1.default.string().trim().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name is required",
        "string.trim": "Name must be a string",
    }),
    email: joi_1.default.string().email().optional().allow("", null),
    phone_no: joi_1.default.string().trim().optional().messages({
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().required().messages({
        "any.required": "Address is required",
        "string.empty": "Address is required",
        "string.trim": "Address must be a string",
    }),
    lat: joi_1.default.number().required().messages({
        "any.required": "Latitude is required",
        "number.base": "Latitude must be a number",
    }),
    long: joi_1.default.number().required().messages({
        "any.required": "Longitude is required",
        "number.base": "Longitude must be a number",
    }),
}).required();
exports.updateCompanySchema = joi_1.default.object({
    name: joi_1.default.string().trim().messages({
        "string.trim": "Name must be a string",
    }),
    email: joi_1.default.string().email().allow("", null),
    phone_no: joi_1.default.string().trim().messages({
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().messages({
        "string.trim": "Address must be a string",
    }),
    lat: joi_1.default.number().messages({
        "number.base": "Latitude must be a number",
    }),
    long: joi_1.default.number().messages({
        "number.base": "Longitude must be a number",
    }),
}).min(1);
exports.listCompaniesQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(500).default(20),
    search: joi_1.default.string().trim().allow("").default(""),
});
exports.companyIdParamSchema = joi_1.default.object({
    id: joi_1.default.number().integer().required().messages({
        "any.required": "Company ID is required",
        "number.base": "Company ID must be a number",
        "number.integer": "Company ID must be an integer",
    }),
});

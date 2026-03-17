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
    email: joi_1.default.string().email().allow("", null),
    phoneNo: joi_1.default.string().trim().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number is required",
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().required().messages({
        "any.required": "Address is required",
        "string.empty": "Address is required",
        "string.trim": "Address must be a string",
    }),
}).required();
exports.updateCompanySchema = joi_1.default.object({
    name: joi_1.default.string().trim().messages({
        "string.trim": "Name must be a string",
    }),
    email: joi_1.default.string().email().allow("", null),
    phoneNo: joi_1.default.string().trim().messages({
        "string.trim": "Phone number must be a string",
    }),
    address: joi_1.default.string().trim().messages({
        "string.trim": "Address must be a string",
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

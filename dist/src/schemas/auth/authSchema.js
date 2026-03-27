"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forgotPasswordResetSchema = exports.forgotPasswordVerifyOtpSchema = exports.forgotPasswordRequestSchema = exports.registerSchema = exports.loginSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.loginSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
}).required();
exports.registerSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    password: joi_1.default.string().required(),
    role: joi_1.default.string().required(),
    adminSecret: joi_1.default.string().optional(),
}).required();
exports.forgotPasswordRequestSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
}).required();
exports.forgotPasswordVerifyOtpSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    otp: joi_1.default.string()
        .length(4)
        .pattern(/^\d{4}$/)
        .required()
        .messages({
        "string.length": "OTP must be 4 digits",
        "string.pattern.base": "OTP must contain digits only",
    }),
}).required();
exports.forgotPasswordResetSchema = joi_1.default.object({
    email: joi_1.default.string().email().required(),
    otp: joi_1.default.string()
        .length(4)
        .pattern(/^\d{4}$/)
        .required()
        .messages({
        "string.length": "OTP must be 4 digits",
        "string.pattern.base": "OTP must contain digits only",
    }),
    newPassword: joi_1.default.string().min(6).required(),
    confirmNewPassword: joi_1.default.string()
        .valid(joi_1.default.ref("newPassword"))
        .required()
        .messages({
        "any.only": "Confirm password must match new password",
    }),
}).required();

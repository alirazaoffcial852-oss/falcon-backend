"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchema = exports.loginSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.loginSchema = joi_1.default.object({
    username: joi_1.default.string().required(),
    password: joi_1.default.string().required(),
}).required();
exports.registerSchema = joi_1.default.object({
    username: joi_1.default.string().required(),
    password: joi_1.default.string().min(6).required(),
    role: joi_1.default.string().valid("admin", "driver", "passenger").required(),
    adminSecret: joi_1.default.string().optional(), // required when creating admin and DB already has users
}).required();

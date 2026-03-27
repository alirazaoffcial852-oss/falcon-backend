"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.carIdParamSchema = exports.listCarsQuerySchema = exports.updateCarSchema = exports.createCarSchema = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createCarSchema = joi_1.default.object({
    name: joi_1.default.string().trim().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name is required",
        "string.trim": "Name must be a string",
    }),
    engine_capacity: joi_1.default.string().trim().required().messages({
        "any.required": "Engine capacity is required",
        "string.empty": "Engine capacity is required",
        "string.trim": "Engine capacity must be a string",
    }),
    model: joi_1.default.string().trim().required().messages({
        "any.required": "Model is required",
        "string.empty": "Model is required",
        "string.trim": "Model must be a string",
    }),
    car_no: joi_1.default.string().trim().required().messages({
        "any.required": "Car number is required",
        "string.empty": "Car number is required",
        "string.trim": "Car number must be a string",
    }),
    car_color: joi_1.default.string().trim().required().messages({
        "any.required": "Car color is required",
        "string.empty": "Car color is required",
        "string.trim": "Car color must be a string",
    }),
    fuel_per_km: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Fuel per km must be a string",
    }),
    car_front_image_url: joi_1.default.string().trim().allow("", null).messages({
        "any.required": "Car front image url is required",
        "string.empty": "Car front image url is required",
        "string.trim": "Car front image url must be a string",
    }),
    car_back_image_url: joi_1.default.string().trim().allow("", null).messages({
        "any.required": "Car back image url is required",
        "string.empty": "Car back image url is required",
        "string.trim": "Car back image url must be a string",
    }),
    car_front_card_url: joi_1.default.string().trim().allow("", null).messages({
        "any.required": "Car front card url is required",
        "string.empty": "Car front card url is required",
        "string.trim": "Car front card url must be a string",
    }),
    car_back_card_url: joi_1.default.string().trim().allow("", null).messages({
        "any.required": "Car back card url is required",
        "string.empty": "Car back card url is required",
        "string.trim": "Car back card url must be a string",
    }),
});
exports.updateCarSchema = joi_1.default.object({
    name: joi_1.default.string().trim().messages({
        "string.trim": "Name must be a string",
    }),
    engine_capacity: joi_1.default.string().trim().messages({
        "string.trim": "Engine capacity must be a string",
    }),
    model: joi_1.default.string().trim().messages({
        "string.trim": "Model must be a string",
    }),
    car_no: joi_1.default.string().trim().messages({
        "string.trim": "Car number must be a string",
    }),
    car_color: joi_1.default.string().trim().messages({
        "string.trim": "Car color must be a string",
    }),
    fuel_per_km: joi_1.default.string().trim().messages({
        "string.trim": "Fuel per km must be a string",
    }),
    car_front_image_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Car front image url must be a string",
    }),
    car_back_image_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Car back image url must be a string",
    }),
    car_front_card_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Car front card url must be a string",
    }),
    car_back_card_url: joi_1.default.string().trim().allow("", null).messages({
        "string.trim": "Car back card url must be a string",
    }),
}).min(1);
exports.listCarsQuerySchema = joi_1.default.object({
    page: joi_1.default.number().integer().min(1).default(1),
    limit: joi_1.default.number().integer().min(1).max(100).default(20),
    search: joi_1.default.string().trim().allow("").default(""),
});
exports.carIdParamSchema = joi_1.default.object({
    id: joi_1.default.number().integer().min(1).required().messages({
        "any.required": "Id is required",
        "number.min": "Id must be greater than 0",
    }),
});

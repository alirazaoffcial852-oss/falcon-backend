"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDriverConfigurationSchema = exports.createDriverConfigurationSchema = void 0;
const joi_1 = __importDefault(require("joi"));
const timeString = joi_1.default.string()
    .trim()
    .required()
    .pattern(/^\d{2}:\d{2}:\d{2}$/)
    .messages({
    "any.required": "Time is required",
    "string.pattern.base": "Time must be in HH:mm:ss format",
});
exports.createDriverConfigurationSchema = joi_1.default.object({
    availability_time: timeString.messages({
        "any.required": "Availability time is required",
    }),
    still_waiting_button_appear_in: timeString.messages({
        "any.required": "Still Waiting Button will appear in is required",
    }),
    remaining_start_time: timeString.messages({
        "any.required": "Remaining Start Time is required",
    }),
    passenger_waiting_time: timeString.messages({
        "any.required": "Passenger Waiting Time is required",
    }),
    skip_button_appear_in: timeString.messages({
        "any.required": "Skip Button will appear in is required",
    }),
}).required();
exports.updateDriverConfigurationSchema = joi_1.default.object({
    availability_time: timeString,
    still_waiting_button_appear_in: timeString,
    remaining_start_time: timeString,
    passenger_waiting_time: timeString,
    skip_button_appear_in: timeString,
}).min(1);

import Joi from "joi";

export const registerDeviceTokenSchema = Joi.object({
	deviceToken: Joi.string().trim().required().messages({
		"any.required": "deviceToken is required",
		"string.empty": "deviceToken is required",
	}),
	platform: Joi.string().trim().valid("android", "ios", "web").optional(),
}).required();

export const unregisterDeviceTokenSchema = Joi.object({
	deviceToken: Joi.string().trim().required().messages({
		"any.required": "deviceToken is required",
		"string.empty": "deviceToken is required",
	}),
}).required();


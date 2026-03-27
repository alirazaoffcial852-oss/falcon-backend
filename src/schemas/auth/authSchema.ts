import Joi from "joi";

export const loginSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
}).required();

export const registerSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
	role: Joi.string().required(),
	adminSecret: Joi.string().optional(),
}).required();

export const forgotPasswordRequestSchema = Joi.object({
	email: Joi.string().email().required(),
}).required();

export const forgotPasswordVerifyOtpSchema = Joi.object({
	email: Joi.string().email().required(),
	otp: Joi.string()
		.length(4)
		.pattern(/^\d{4}$/)
		.required()
		.messages({
			"string.length": "OTP must be 4 digits",
			"string.pattern.base": "OTP must contain digits only",
		}),
}).required();

export const forgotPasswordResetSchema = Joi.object({
	email: Joi.string().email().required(),
	otp: Joi.string()
		.length(4)
		.pattern(/^\d{4}$/)
		.required()
		.messages({
			"string.length": "OTP must be 4 digits",
			"string.pattern.base": "OTP must contain digits only",
		}),
	newPassword: Joi.string().min(6).required(),
	confirmNewPassword: Joi.string()
		.valid(Joi.ref("newPassword"))
		.required()
		.messages({
			"any.only": "Confirm password must match new password",
		}),
}).required();

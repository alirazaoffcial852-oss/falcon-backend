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

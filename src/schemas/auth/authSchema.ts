import Joi from "joi";

export const loginSchema = Joi.object({
	username: Joi.string().required(),
	password: Joi.string().required(),
}).required();

export const registerSchema = Joi.object({
	username: Joi.string().required(),
	password: Joi.string().min(6).required(),
	role: Joi.string().valid("admin", "driver", "passenger").required(),
	adminSecret: Joi.string().optional(), // required when creating admin and DB already has users
}).required();

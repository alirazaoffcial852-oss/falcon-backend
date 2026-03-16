import Joi from "joi";

export const loginSchema = Joi.object({
	username: Joi.string().required(),
	password: Joi.string().required(),
}).required();

export const registerSchema = Joi.object({
	username: Joi.string().required(),
	password: Joi.string().required(),
	role: Joi.string().required(),
}).required();

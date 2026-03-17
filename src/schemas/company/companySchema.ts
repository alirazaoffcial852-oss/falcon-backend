import Joi from "joi";

export const createCompanySchema = Joi.object({
	name: Joi.string().trim().required().messages({
		"any.required": "Name is required",
		"string.empty": "Name is required",
		"string.trim": "Name must be a string",
	}),
	email: Joi.string().email().allow("", null),
	phone_no: Joi.string().trim().required().messages({
		"any.required": "Phone number is required",
		"string.empty": "Phone number is required",
		"string.trim": "Phone number must be a string",
	}),
	address: Joi.string().trim().required().messages({
		"any.required": "Address is required",
		"string.empty": "Address is required",
		"string.trim": "Address must be a string",
	}),
}).required();

export const updateCompanySchema = Joi.object({
	name: Joi.string().trim().messages({
		"string.trim": "Name must be a string",
	}),
	email: Joi.string().email().allow("", null),
	phone_no: Joi.string().trim().messages({
		"string.trim": "Phone number must be a string",
	}),
	address: Joi.string().trim().messages({
		"string.trim": "Address must be a string",
	}),
}).min(1);

export const listCompaniesQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(500).default(20),
	search: Joi.string().trim().allow("").default(""),
});

export const companyIdParamSchema = Joi.object({
	id: Joi.number().integer().required().messages({
		"any.required": "Company ID is required",
		"number.base": "Company ID must be a number",
		"number.integer": "Company ID must be an integer",
	}),
});

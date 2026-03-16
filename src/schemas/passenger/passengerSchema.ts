import Joi from "joi";

export const createPassengerSchema = Joi.object({
	name: Joi.string().trim().required().messages({
		"any.required": "Name is required",
		"string.empty": "Name is required",
		"string.trim": "Name must be a string",
	}),
	phoneNo: Joi.string().trim().required().messages({
		"any.required": "Phone number is required",
		"string.empty": "Phone number is required",
		"string.trim": "Phone number must be a string",
	}),
	officeAddress: Joi.string().trim().required().messages({
		"any.required": "Office address is required",
		"string.empty": "Office address is required",
		"string.trim": "Office address must be a string",
	}),
	companyId: Joi.number().integer().min(1).required().messages({
		"any.required": "Company id is required",
		"number.min": "Company id must be greater than 0",
	}),
	pickUpTime: Joi.string().trim().allow("", null).messages({
		"string.trim": "Pick up time must be a string",
	}),
	dropOffTime: Joi.string().trim().allow("", null).messages({
		"string.trim": "Drop off time must be a string",
	}),
}).required();

export const updatePassengerSchema = Joi.object({
	name: Joi.string().trim().messages({
		"string.trim": "Name must be a string",
	}),
	phoneNo: Joi.string().trim().messages({
		"string.trim": "Phone number must be a string",
	}),
	officeAddress: Joi.string().trim().messages({
		"string.trim": "Office address must be a string",
	}),
	companyId: Joi.number().integer().min(1).messages({
		"number.min": "Company id must be greater than 0",
	}),
	pickUpTime: Joi.string().trim().allow("", null).messages({
		"string.trim": "Pick up time must be a string",
	}),
	dropOffTime: Joi.string().trim().allow("", null).messages({
		"string.trim": "Drop off time must be a string",
	}),
}).min(1);

export const listPassengersQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	search: Joi.string().trim().allow(""),
	companyId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
});

export const passengerIdParamSchema = Joi.object({
	id: Joi.number().integer().required().messages({
		"any.required": "Passenger id is required",
		"number.base": "Passenger id must be a number",
		"number.integer": "Passenger id must be an integer",
	}),
});

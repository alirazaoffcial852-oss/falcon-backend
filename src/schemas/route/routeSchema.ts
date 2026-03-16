import Joi from "joi";

const routeStatusValues = [
	"PENDING",
	"ONGOING",
	"COMPLETED",
	"CANCELLED",
] as const;

const routeLegSchema = Joi.object({
	passengerId: Joi.number().integer().min(1).required().messages({
		"any.required": "Passenger id is required",
		"number.min": "Passenger id must be greater than 0",
	}),
	pickupAddress: Joi.string().trim().required().messages({
		"any.required": "Pickup address is required",
		"string.empty": "Pickup address is required",
	}),
	pickupLat: Joi.number().required().messages({
		"any.required": "Pickup latitude is required",
		"number.base": "Pickup latitude must be a number",
	}),
	pickupLong: Joi.number().required().messages({
		"any.required": "Pickup longitude is required",
		"number.base": "Pickup longitude must be a number",
	}),
	pickupTime: Joi.string().trim().required().messages({
		"any.required": "Pickup time is required",
		"string.empty": "Pickup time is required",
	}),
	dropoffAddress: Joi.string().trim().required().messages({
		"any.required": "Dropoff address is required",
		"string.empty": "Dropoff address is required",
	}),
	dropoffLat: Joi.number().required().messages({
		"any.required": "Dropoff latitude is required",
		"number.base": "Dropoff latitude must be a number",
	}),
	dropoffLong: Joi.number().required().messages({
		"any.required": "Dropoff longitude is required",
		"number.base": "Dropoff longitude must be a number",
	}),
	dropoffTime: Joi.string().trim().required().messages({
		"any.required": "Dropoff time is required",
		"string.empty": "Dropoff time is required",
	}),
	tollAmount: Joi.number().allow(null).messages({
		"number.base": "Toll amount must be a number",
	}),
});

export const createRouteSchema = Joi.object({
	companyId: Joi.number().integer().min(1).required().messages({
		"any.required": "Company id is required",
		"number.min": "Company id must be greater than 0",
	}),
	driverId: Joi.number().integer().min(1).required().messages({
		"any.required": "Driver id is required",
		"number.min": "Driver id must be greater than 0",
	}),
	officeAddress: Joi.string().trim().required().messages({
		"any.required": "Office address is required",
		"string.empty": "Office address is required",
	}),
	officeLat: Joi.number().required().messages({
		"any.required": "Office latitude is required",
		"number.base": "Office latitude must be a number",
	}),
	officeLong: Joi.number().required().messages({
		"any.required": "Office longitude is required",
		"number.base": "Office longitude must be a number",
	}),
	legs: Joi.array().items(routeLegSchema).min(1).required().messages({
		"any.required": "At least one leg is required",
		"array.min": "At least one leg is required",
	}),
}).required();

export const updateRouteSchema = Joi.object({
	companyId: Joi.number().integer().min(1).messages({
		"number.min": "Company id must be greater than 0",
	}),
	driverId: Joi.number().integer().min(1).messages({
		"number.min": "Driver id must be greater than 0",
	}),
	officeAddress: Joi.string().trim().messages({
		"string.trim": "Office address must be a string",
	}),
	officeLat: Joi.number().messages({
		"number.base": "Office latitude must be a number",
	}),
	officeLong: Joi.number().messages({
		"number.base": "Office longitude must be a number",
	}),
	legs: Joi.array().items(routeLegSchema).min(1).messages({
		"array.min": "At least one leg is required",
	}),
}).min(1);

export const listRoutesQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	search: Joi.string().trim().allow("").default(""),
	status: Joi.string()
		.valid(...routeStatusValues)
		.optional(),
	companyId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	driverId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
});

export const routeIdParamSchema = Joi.object({
	id: Joi.number().integer().min(1).required().messages({
		"any.required": "Route id is required",
		"number.min": "Route id must be greater than 0",
	}),
});

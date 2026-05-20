import Joi from "joi";

export const createFuelPriceSchema = Joi.object({
	price_per_liter: Joi.number().positive().required().messages({
		"any.required": "price_per_liter is required",
		"number.base": "price_per_liter must be a number",
		"number.positive": "price_per_liter must be greater than 0",
	}),
	effective_from: Joi.string()
		.isoDate()
		.optional()
		.messages({ "string.isoDate": "effective_from must be ISO datetime" }),
}).required();

export const updateFuelPriceSchema = Joi.object({
	price_per_liter: Joi.number().positive().optional().messages({
		"number.base": "price_per_liter must be a number",
		"number.positive": "price_per_liter must be greater than 0",
	}),
	effective_from: Joi.string()
		.isoDate()
		.optional()
		.messages({ "string.isoDate": "effective_from must be ISO datetime" }),
}).min(1);

export const fuelPriceIdParamSchema = Joi.object({
	id: Joi.number().integer().min(1).required().messages({
		"any.required": "Id is required",
		"number.min": "Id must be greater than 0",
	}),
});

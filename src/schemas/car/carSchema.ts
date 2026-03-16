import Joi from "joi";

export const createCarSchema = Joi.object({
	name: Joi.string().trim().required().messages({
		"any.required": "Name is required",
		"string.empty": "Name is required",
		"string.trim": "Name must be a string",
	}),
	engine_capacity: Joi.string().trim().required().messages({
		"any.required": "Engine capacity is required",
		"string.empty": "Engine capacity is required",
		"string.trim": "Engine capacity must be a string",
	}),
	model: Joi.string().trim().required().messages({
		"any.required": "Model is required",
		"string.empty": "Model is required",
		"string.trim": "Model must be a string",
	}),
	car_no: Joi.string().trim().required().messages({
		"any.required": "Car number is required",
		"string.empty": "Car number is required",
		"string.trim": "Car number must be a string",
	}),
	car_color: Joi.string().trim().required().messages({
		"any.required": "Car color is required",
		"string.empty": "Car color is required",
		"string.trim": "Car color must be a string",
	}),
	fuel_per_km: Joi.string().trim().allow("", null).messages({
		"string.trim": "Fuel per km must be a string",
	}),
	car_front_image_url: Joi.string().trim().allow("", null).messages({
		"any.required": "Car front image url is required",
		"string.empty": "Car front image url is required",
		"string.trim": "Car front image url must be a string",
	}),
	car_back_image_url: Joi.string().trim().allow("", null).messages({
		"any.required": "Car back image url is required",
		"string.empty": "Car back image url is required",
		"string.trim": "Car back image url must be a string",
	}),
	car_front_card_url: Joi.string().trim().allow("", null).messages({
		"any.required": "Car front card url is required",
		"string.empty": "Car front card url is required",
		"string.trim": "Car front card url must be a string",
	}),
	car_back_card_url: Joi.string().trim().allow("", null).messages({
		"any.required": "Car back card url is required",
		"string.empty": "Car back card url is required",
		"string.trim": "Car back card url must be a string",
	}),
});

export const updateCarSchema = Joi.object({
	name: Joi.string().trim().messages({
		"string.trim": "Name must be a string",
	}),
	engine_capacity: Joi.string().trim().messages({
		"string.trim": "Engine capacity must be a string",
	}),
	model: Joi.string().trim().messages({
		"string.trim": "Model must be a string",
	}),
	car_no: Joi.string().trim().messages({
		"string.trim": "Car number must be a string",
	}),
	car_color: Joi.string().trim().messages({
		"string.trim": "Car color must be a string",
	}),
	fuel_per_km: Joi.string().trim().messages({
		"string.trim": "Fuel per km must be a string",
	}),
	car_front_image_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Car front image url must be a string",
	}),
	car_back_image_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Car back image url must be a string",
	}),
	car_front_card_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Car front card url must be a string",
	}),
	car_back_card_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Car back card url must be a string",
	}),
}).min(1);

export const listCarsQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	search: Joi.string().trim().allow("").default(""),
});

export const carIdParamSchema = Joi.object({
	id: Joi.number().integer().min(1).required().messages({
		"any.required": "Id is required",
		"number.min": "Id must be greater than 0",
	}),
});

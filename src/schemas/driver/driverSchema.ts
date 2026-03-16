import Joi from "joi";

export const createDriverSchema = Joi.object({
	name: Joi.string().trim().required().messages({
		"any.required": "Name is required",
		"string.empty": "Name is required",
		"string.trim": "Name must be a string",
	}),
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
	emergency_phone_no: Joi.string().trim().required().messages({
		"any.required": "Emergency phone number is required",
		"string.empty": "Emergency phone number is required",
		"string.trim": "Emergency phone number must be a string",
	}),
	driver_image_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver image url must be a string",
	}),
	rate_per_km: Joi.number().allow(null).messages({
		"number.base": "Rate per km must be a number",
	}),
	driver_cnic_front_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver cnic front url must be a string",
	}),
	driver_cnic_back_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver cnic back url must be a string",
	}),
	driver_license_front_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver license front url must be a string",
	}),
	driver_license_back_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver license back url must be a string",
	}),
	salary: Joi.string().trim().allow("", null).messages({
		"string.trim": "Salary must be a string",
	}),
	car_id: Joi.number().integer().min(1).required().messages({
		"any.required": "Car id is required",
		"number.min": "Car id must be greater than 0",
	}),
}).required();

export const updateDriverSchema = Joi.object({
	name: Joi.string().trim().required().messages({
		"any.required": "Name is required",
		"string.trim": "Name must be a string",
	}),
	phone_no: Joi.string().trim().required().messages({
		"any.required": "Phone number is required",
		"string.trim": "Phone number must be a string",
	}),
	address: Joi.string().trim().required().messages({
		"any.required": "Address is required",
		"string.trim": "Address must be a string",
	}),
	emergency_phone_no: Joi.string().trim().required().messages({
		"any.required": "Emergency phone number is required",
		"string.trim": "Emergency phone number must be a string",
	}),
	driver_image_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver image url must be a string",
	}),
	rate_per_km: Joi.number().required().messages({
		"any.required": "Rate per km is required",
		"number.base": "Rate per km must be a number",
	}),
	driver_cnic_front_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver cnic front url must be a string",
	}),
	driver_cnic_back_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver cnic back url must be a string",
	}),
	driver_license_front_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver license front url must be a string",
	}),
	driver_license_back_url: Joi.string().trim().allow("", null).messages({
		"string.trim": "Driver license back url must be a string",
	}),
	salary: Joi.string().trim().required().messages({
		"string.trim": "Salary must be a string",
	}),
	car_id: Joi.number().integer().min(1).required().messages({
		"any.required": "Car id is required",
	}),
}).min(1);

export const listDriversQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	search: Joi.string().trim().allow("").default(""),
});

export const driverIdParamSchema = Joi.object({
	id: Joi.number().integer().min(1).required().messages({
		"any.required": "Id is required",
		"number.min": "Id must be greater than 0",
	}),
});

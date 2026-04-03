import Joi from "joi";

export const companyIdParamSchema = Joi.object({
	companyId: Joi.string().pattern(/^[1-9]\d*$/).required(),
});

export const driverIdParamSchema = Joi.object({
	driverId: Joi.string().pattern(/^[1-9]\d*$/).required(),
});

export const scheduleIdParamSchema = Joi.object({
	id: Joi.string().pattern(/^[1-9]\d*$/).required(),
});

export const companyHolidayBodySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "date must be YYYY-MM-DD" }),
	name: Joi.string().trim().allow("").optional(),
});

export const driverLeaveBodySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "date must be YYYY-MM-DD" }),
	note: Joi.string().trim().allow("").optional(),
});

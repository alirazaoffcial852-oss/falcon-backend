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

export const updateCompanyHolidayBodySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({ "string.pattern.base": "date must be YYYY-MM-DD" }),
	name: Joi.string().trim().allow("").optional(),
}).min(1);

export const driverLeaveBodySchema = Joi.object({
	from: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "from must be YYYY-MM-DD" }),
	to: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "to must be YYYY-MM-DD" }),
	note: Joi.string().trim().allow("").optional(),
});

export const driverLeaveRangeQuerySchema = Joi.object({
	from: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({ "string.pattern.base": "from must be YYYY-MM-DD" }),
	to: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({ "string.pattern.base": "to must be YYYY-MM-DD" }),
});

import Joi from "joi";

export const grantAvailabilityOverrideSchema = Joi.object({
	phase_driver_id: Joi.number().integer().min(1).required().messages({
		"any.required": "phase_driver_id is required",
	}),
	duration_minutes: Joi.number().integer().min(1).max(120).optional().default(10),
}).required();

export const availabilityMissedQuerySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({ "string.pattern.base": "date must be YYYY-MM-DD" }),
});

export const stillWaitingQuerySchema = availabilityMissedQuerySchema;

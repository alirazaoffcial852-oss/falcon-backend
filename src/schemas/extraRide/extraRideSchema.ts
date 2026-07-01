import Joi from "joi";

export const createExtraRideBodySchema = Joi.object({
	phase_driver_id: Joi.number().integer().min(1),
	phaseDriverId: Joi.number().integer().min(1),
	driver_id: Joi.number().integer().min(1),
	driverId: Joi.number().integer().min(1),
	trip_price: Joi.number().min(0).required(),
	fuel_cost: Joi.number().min(0).optional().allow(null),
	mark_salary_paid: Joi.boolean().optional(),
	markSalaryPaid: Joi.boolean().optional(),
	mark_fuel_paid: Joi.boolean().optional(),
	markFuelPaid: Joi.boolean().optional(),
	reset_phase: Joi.boolean().optional(),
	reason: Joi.string().trim().max(500).allow("").optional(),
	note: Joi.string().trim().max(1000).allow("").optional(),
})
	.or("phase_driver_id", "phaseDriverId")
	.or("driver_id", "driverId")
	.messages({
		"object.missing": "phase_driver_id and driver_id are required",
	});

export const extraRideHistoryQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	from: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "from must be YYYY-MM-DD",
		}),
	to: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "to must be YYYY-MM-DD",
		}),
	date_from: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date_from must be YYYY-MM-DD",
		}),
	date_to: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date_to must be YYYY-MM-DD",
		}),
	driverId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	driver_id: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	routeDailyPlanId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	routeId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
});

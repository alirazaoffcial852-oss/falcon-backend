import Joi from "joi";

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
	pickupTime: Joi.string().trim().optional().allow(""),
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
	dropoffTime: Joi.string().trim().optional().allow(""),
	tollAmount: Joi.number().allow(null).messages({
		"number.base": "Toll amount must be a number",
	}),
});

const batchSchema = Joi.object({
	legs: Joi.array().items(routeLegSchema).min(1).required().messages({
		"array.min": "Each batch needs at least one leg",
	}),
});

export const createRouteSchema = Joi.object({
	route_name: Joi.string().trim().min(1).max(100),
	routeName: Joi.string().trim().min(1).max(100),
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
	route_price: Joi.number().required().messages({
		"any.required": "route_price is required",
		"number.base": "route_price must be a number",
	}),
	batches: Joi.array().items(batchSchema).min(1),
	legs: Joi.array().items(routeLegSchema).min(1),
	recurringPlanStartDate: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "recurringPlanStartDate must be YYYY-MM-DD",
		}),
	recurring_plan_start: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "recurring_plan_start must be YYYY-MM-DD",
		}),
	recurringPlanMonths: Joi.number().integer().min(0).max(36).optional(),
	is_active: Joi.boolean().optional(),
	waypointMode: Joi.string().valid("auto", "manual").messages({
		"any.only": "waypointMode must be auto or manual",
	}),
	waypoint_mode: Joi.string().valid("auto", "manual").messages({
		"any.only": "waypoint_mode must be auto or manual",
	}),
})
	.or("batches", "legs")
	.or("waypointMode", "waypoint_mode")
	.or("route_name", "routeName")
	.messages({
		"object.missing": "Provide batches (preferred) or legacy legs array",
	})
	.required();

export const updateRouteSchema = Joi.object({
	route_name: Joi.string().trim().min(1).max(100).optional(),
	routeName: Joi.string().trim().min(1).max(100).optional(),
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
	route_price: Joi.number().messages({
		"number.base": "route_price must be a number",
	}),
	batches: Joi.array().items(batchSchema).min(1),
	legs: Joi.array().items(routeLegSchema).min(1),
	recurringPlanStartDate: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	recurring_plan_start: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	recurringPlanMonths: Joi.number().integer().min(0).max(36).optional(),
	is_active: Joi.boolean().optional(),
	waypointMode: Joi.string().valid("auto", "manual").optional(),
	waypoint_mode: Joi.string().valid("auto", "manual").optional(),
}).min(0);

export const routeActiveStatusBodySchema = Joi.object({
	is_active: Joi.boolean()
		.truthy("true", "1", "TRUE", "True")
		.falsy("false", "0", "FALSE", "False")
		.required(),
});

export const listRoutesQuerySchema = Joi.object({
	page: Joi.number().integer().min(1).default(1),
	limit: Joi.number().integer().min(1).max(100).default(20),
	search: Joi.string().trim().allow("").default(""),
	companyId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	driverId: Joi.string()
		.pattern(/^[1-9]\d*$/)
		.allow(""),
	status: Joi.string()
		.valid("PENDING", "ONGOING", "COMPLETED")
		.optional(),
	is_active: Joi.boolean()
		.truthy("true", "1", "TRUE", "True")
		.falsy("false", "0", "FALSE", "False")
		.optional(),
});

/** Optional calendar day (YYYY-MM-DD); defaults to today. */
export const optionalDayBodySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date must be YYYY-MM-DD",
		}),
});

/** POST /routes/generate-daily — optional `plannedOnly` matches cron (only templates inside plan window). */
export const generateDailyBodySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date must be YYYY-MM-DD",
		}),
	plannedOnly: Joi.boolean().optional(),
});

/** GET /routes/generate-daily/preview */
export const generateDailyPreviewQuerySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date must be YYYY-MM-DD",
		}),
	plannedOnly: Joi.boolean().optional(),
});

export const routeHistoryQuerySchema = Joi.object({
	date: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.optional()
		.messages({
			"string.pattern.base": "date must be YYYY-MM-DD",
		}),
	companyId: Joi.number().integer().min(1).optional(),
	driverId: Joi.number().integer().min(1).optional(),
});

export const planStatsQuerySchema = Joi.object({
	from: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "from must be YYYY-MM-DD" }),
	to: Joi.string()
		.pattern(/^\d{4}-\d{2}-\d{2}$/)
		.required()
		.messages({ "string.pattern.base": "to must be YYYY-MM-DD" }),
});

export const routeIdParamSchema = Joi.object({
	id: Joi.number().integer().min(1).required().messages({
		"any.required": "Route id is required",
		"number.min": "Route id must be greater than 0",
	}),
});

export const phaseDriverIdParamSchema = Joi.object({
	phaseDriverId: Joi.number().integer().min(1).required().messages({
		"any.required": "phaseDriverId is required",
		"number.min": "phaseDriverId must be greater than 0",
	}),
});

export const reassignPhaseDriverBodySchema = Joi.object({
	driver_id: Joi.number().integer().min(1),
	driverId: Joi.number().integer().min(1),
	reset_phase: Joi.boolean().optional(),
})
	.or("driver_id", "driverId")
	.messages({
		"object.missing": "driver_id is required",
	});

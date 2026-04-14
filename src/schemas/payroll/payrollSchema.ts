import Joi from "joi";

const ymd = Joi.string()
	.pattern(/^\d{4}-\d{2}-\d{2}$/)
	.required();

export const payrollPreviewQuerySchema = Joi.object({
	from: ymd.messages({ "string.pattern.base": "from must be YYYY-MM-DD" }),
	to: ymd.messages({ "string.pattern.base": "to must be YYYY-MM-DD" }),
	driverId: Joi.number().integer().min(1).optional(),
});

export const payrollSettleBodySchema = Joi.object({
	from: ymd.messages({ "string.pattern.base": "from must be YYYY-MM-DD" }),
	to: ymd.messages({ "string.pattern.base": "to must be YYYY-MM-DD" }),
	driver_id: Joi.number().integer().min(1).optional(),
	components: Joi.array()
		.items(Joi.string().valid("SALARY", "FUEL"))
		.min(1)
		.required(),
});

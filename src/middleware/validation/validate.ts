import type { Request, Response, NextFunction } from "express";
import type { Schema } from "joi";

export const validate = {
	body: (schema: Schema) => {
		return (req: Request, res: Response, next: NextFunction) => {
			const { error, value } = schema.validate(req.body, {
				abortEarly: false,
				stripUnknown: true,
			});
			if (error) {
				return next(error);
			}
			req.body = value;
			next();
		};
	},

	params: (schema: Schema) => {
		return (req: Request, res: Response, next: NextFunction) => {
			const { error } = schema.validate(req.params, { abortEarly: false });
			if (error) {
				return next(error);
			}
			next();
		};
	},

	query: (schema: Schema) => {
		return (req: Request, res: Response, next: NextFunction) => {
			const { error, value } = schema.validate(req.query, {
				abortEarly: false,
				stripUnknown: true,
			});

			if (error) {
				return next(error);
			}

			// Merge validated values into req.query using Object.assign
			// since req.query is read-only and cannot be directly assigned
			Object.assign(req.query, value);
			next();
		};
	},

	combined: (bodySchema: Schema, paramsSchema: Schema) => {
		return (req: Request, res: Response, next: NextFunction) => {
			const paramsResult = paramsSchema.validate(req.params, {
				abortEarly: false,
				stripUnknown: true,
			});

			if (paramsResult.error) {
				return next(paramsResult.error);
			}
			Object.assign(req.params, paramsResult.value);

			const bodyResult = bodySchema.validate(req.body, {
				abortEarly: false,
				stripUnknown: true,
			});
			if (bodyResult.error) {
				return next(bodyResult.error);
			}
			req.body = bodyResult.value;
			next();
		};
	},
};

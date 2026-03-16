import type { Request, Response, NextFunction } from "express";
import { ValidationError } from "joi";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

export const errorHandler = (
	err: Error & {
		errors?: Record<string, string[]>;
		statusCode?: number;
		code?: string;
		meta?: { target?: string[] };
	},
	req: Request,
	res: Response,
	_next: NextFunction,
) => {
	console.error(err);

	if (err.code?.startsWith("P")) {
		switch (err.code) {
			case "P2002": {
				const target = err.meta?.target?.join(", ");
				const appError = ResponseHandler.duplicateResource(
					"Record",
					target || "field",
				);
				return ResponseHandler.error(res, appError);
			}
			case "P2025":
				return ResponseHandler.error(
					res,
					ResponseHandler.notFound("Record not found"),
				);
			case "P2003":
				return ResponseHandler.error(
					res,
					ResponseHandler.badRequest("Foreign key constraint failed"),
				);
			default:
				return ResponseHandler.error(
					res,
					ResponseHandler.badRequest(`Database error: ${err.message}`),
				);
		}
	}

	if (err instanceof ValidationError) {
		const validationError = ResponseHandler.fromValidationError(err);
		return ResponseHandler.error(res, validationError);
	}

	if (err.statusCode) {
		return ResponseHandler.error(res, err);
	}

	const genericError = ResponseHandler.internal(
		err.message || "An unexpected error occurred",
	);
	return ResponseHandler.error(res, genericError);
};

import { Response } from "express";
import { ValidationError } from "joi";
import { ErrorType } from "../errors/ErrorTypes";

export enum StatusCode {
	OK = 200,
	CREATED = 201,
	NO_CONTENT = 204,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	DUPLICATE_RESOURCE = 409,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	INTERNAL_SERVER_ERROR = 500,
}

export interface CustomError {
	message: string;
	statusCode: number;
	type: ErrorType;
	errors?: Record<string, string[]>;
	stack?: string;
}

export class ResponseHandler {
	// Response-related methods (used in controllers)
	static success(
		res: Response,
		data?: any,
		message = "Success",
		statusCode = StatusCode.OK,
	) {
		return res.status(statusCode).json({
			status: "success",
			message,
			data: data || null,
		});
	}

	static created(
		res: Response,
		data: any,
		message = "Resource created successfully",
	) {
		return this.success(res, data, message, StatusCode.CREATED);
	}

	static noContent(res: Response) {
		return res.status(StatusCode.NO_CONTENT).send();
	}

	static error(res: Response, error: any) {
		const statusCode = error.statusCode || StatusCode.INTERNAL_SERVER_ERROR;
		const errorResponse: any = {
			status: "error",
			message: error.message || "An unexpected error occurred",
			type: error.type || "INTERNAL_SERVER_ERROR",
		};

		if (error.errors) {
			errorResponse.errors = error.errors;
		}

		if (process.env.NODE_ENV === "development" && error.stack) {
			errorResponse.stack = error.stack;
		}

		return res.status(statusCode).json(errorResponse);
	}

	static createError(
		message: string,
		statusCode: number = 500,
		type: ErrorType = ErrorType.INTERNAL,
		errors?: Record<string, string[]>,
	): CustomError {
		const error: CustomError = {
			message,
			statusCode,
			type,
			errors,
		};

		// Capture stack trace if in development
		if (process.env.NODE_ENV === "development") {
			const stackObj = new Error(message);
			Error.captureStackTrace(stackObj, this.createError);
			error.stack = stackObj.stack;
		}

		return error;
	}

	static fromValidationError(validationError: ValidationError): CustomError {
		const errors: Record<string, string[]> = {};

		for (const detail of validationError.details) {
			const key = detail.path.join(".");
			if (!errors[key]) {
				errors[key] = [];
			}
			errors[key].push(detail.message);
		}

		return this.createError(
			"Validation failed",
			StatusCode.BAD_REQUEST,
			ErrorType.VALIDATION,
			errors,
		);
	}

	static notFound(resource: string, id?: string | number): CustomError {
		const idStr = id ? ` with id ${id}` : "";
		return this.createError(
			`${resource}${idStr}`,
			StatusCode.NOT_FOUND,
			ErrorType.NOT_FOUND,
		);
	}

	static badRequest(message: string): CustomError {
		return this.createError(
			message,
			StatusCode.BAD_REQUEST,
			ErrorType.BAD_REQUEST,
		);
	}

	static unauthorized(message = "Unauthorized"): CustomError {
		return this.createError(
			message,
			StatusCode.UNAUTHORIZED,
			ErrorType.UNAUTHORIZED,
		);
	}

	static forbidden(message = "Forbidden"): CustomError {
		return this.createError(message, StatusCode.FORBIDDEN, ErrorType.FORBIDDEN);
	}

	static internal(message = "Internal server error"): CustomError {
		return this.createError(
			message,
			StatusCode.INTERNAL_SERVER_ERROR,
			ErrorType.INTERNAL,
		);
	}

	static duplicateResource(resource: string, key: string): CustomError {
		return this.createError(
			`${resource} with this ${key} already exists`,
			StatusCode.DUPLICATE_RESOURCE,
			ErrorType.DUPLICATE_RESOURCE,
		);
	}
}

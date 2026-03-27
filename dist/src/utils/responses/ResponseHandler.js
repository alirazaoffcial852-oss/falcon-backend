"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseHandler = exports.StatusCode = void 0;
const ErrorTypes_1 = require("../errors/ErrorTypes");
var StatusCode;
(function (StatusCode) {
    StatusCode[StatusCode["OK"] = 200] = "OK";
    StatusCode[StatusCode["CREATED"] = 201] = "CREATED";
    StatusCode[StatusCode["NO_CONTENT"] = 204] = "NO_CONTENT";
    StatusCode[StatusCode["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    StatusCode[StatusCode["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    StatusCode[StatusCode["DUPLICATE_RESOURCE"] = 409] = "DUPLICATE_RESOURCE";
    StatusCode[StatusCode["FORBIDDEN"] = 403] = "FORBIDDEN";
    StatusCode[StatusCode["NOT_FOUND"] = 404] = "NOT_FOUND";
    StatusCode[StatusCode["INTERNAL_SERVER_ERROR"] = 500] = "INTERNAL_SERVER_ERROR";
})(StatusCode || (exports.StatusCode = StatusCode = {}));
class ResponseHandler {
    // Response-related methods (used in controllers)
    static success(res, data, message = "Success", statusCode = StatusCode.OK) {
        return res.status(statusCode).json({
            status: "success",
            message,
            data: data || null,
        });
    }
    static created(res, data, message = "Resource created successfully") {
        return this.success(res, data, message, StatusCode.CREATED);
    }
    static noContent(res) {
        return res.status(StatusCode.NO_CONTENT).send();
    }
    static error(res, error) {
        const statusCode = error.statusCode || StatusCode.INTERNAL_SERVER_ERROR;
        const errorResponse = {
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
    static createError(message, statusCode = 500, type = ErrorTypes_1.ErrorType.INTERNAL, errors) {
        const error = {
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
    static fromValidationError(validationError) {
        const errors = {};
        for (const detail of validationError.details) {
            const key = detail.path.join(".");
            if (!errors[key]) {
                errors[key] = [];
            }
            errors[key].push(detail.message);
        }
        return this.createError("Validation failed", StatusCode.BAD_REQUEST, ErrorTypes_1.ErrorType.VALIDATION, errors);
    }
    static notFound(resource, id) {
        const idStr = id ? ` with id ${id}` : "";
        return this.createError(`${resource}${idStr}`, StatusCode.NOT_FOUND, ErrorTypes_1.ErrorType.NOT_FOUND);
    }
    static badRequest(message) {
        return this.createError(message, StatusCode.BAD_REQUEST, ErrorTypes_1.ErrorType.BAD_REQUEST);
    }
    static unauthorized(message = "Unauthorized") {
        return this.createError(message, StatusCode.UNAUTHORIZED, ErrorTypes_1.ErrorType.UNAUTHORIZED);
    }
    static forbidden(message = "Forbidden") {
        return this.createError(message, StatusCode.FORBIDDEN, ErrorTypes_1.ErrorType.FORBIDDEN);
    }
    static internal(message = "Internal server error") {
        return this.createError(message, StatusCode.INTERNAL_SERVER_ERROR, ErrorTypes_1.ErrorType.INTERNAL);
    }
    static duplicateResource(resource, key) {
        return this.createError(`${resource} with this ${key} already exists`, StatusCode.DUPLICATE_RESOURCE, ErrorTypes_1.ErrorType.DUPLICATE_RESOURCE);
    }
}
exports.ResponseHandler = ResponseHandler;

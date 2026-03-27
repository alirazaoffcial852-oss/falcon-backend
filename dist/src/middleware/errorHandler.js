"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const joi_1 = require("joi");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const errorHandler = (err, req, res, _next) => {
    console.error(err);
    if (err.code?.startsWith("P")) {
        switch (err.code) {
            case "P2002": {
                const target = err.meta?.target?.join(", ");
                const appError = ResponseHandler_1.ResponseHandler.duplicateResource("Record", target || "field");
                return ResponseHandler_1.ResponseHandler.error(res, appError);
            }
            case "P2025":
                return ResponseHandler_1.ResponseHandler.error(res, ResponseHandler_1.ResponseHandler.notFound("Record not found"));
            case "P2003":
                return ResponseHandler_1.ResponseHandler.error(res, ResponseHandler_1.ResponseHandler.badRequest("Foreign key constraint failed"));
            default:
                return ResponseHandler_1.ResponseHandler.error(res, ResponseHandler_1.ResponseHandler.badRequest(`Database error: ${err.message}`));
        }
    }
    if (err instanceof joi_1.ValidationError) {
        const validationError = ResponseHandler_1.ResponseHandler.fromValidationError(err);
        return ResponseHandler_1.ResponseHandler.error(res, validationError);
    }
    if (err.statusCode) {
        return ResponseHandler_1.ResponseHandler.error(res, err);
    }
    const genericError = ResponseHandler_1.ResponseHandler.internal(err.message || "An unexpected error occurred");
    return ResponseHandler_1.ResponseHandler.error(res, genericError);
};
exports.errorHandler = errorHandler;

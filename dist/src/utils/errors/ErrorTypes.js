"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorType = void 0;
var ErrorType;
(function (ErrorType) {
    ErrorType["VALIDATION"] = "VALIDATION_ERROR";
    ErrorType["NOT_FOUND"] = "NOT_FOUND";
    ErrorType["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorType["FORBIDDEN"] = "FORBIDDEN";
    ErrorType["BAD_REQUEST"] = "BAD_REQUEST";
    ErrorType["INTERNAL"] = "INTERNAL_SERVER_ERROR";
    ErrorType["DUPLICATE_RESOURCE"] = "DUPLICATE_RESOURCE";
})(ErrorType || (exports.ErrorType = ErrorType = {}));

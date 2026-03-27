"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
exports.validate = {
    body: (schema) => {
        return (req, res, next) => {
            const { error } = schema.validate(req.body, { abortEarly: false });
            if (error) {
                return next(error);
            }
            next();
        };
    },
    params: (schema) => {
        return (req, res, next) => {
            const { error } = schema.validate(req.params, { abortEarly: false });
            if (error) {
                return next(error);
            }
            next();
        };
    },
    query: (schema) => {
        return (req, res, next) => {
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
    combined: (bodySchema, paramsSchema) => {
        return (req, res, next) => {
            const paramsResult = paramsSchema.validate(req.params, {
                abortEarly: false,
            });
            if (paramsResult.error) {
                return next(paramsResult.error);
            }
            const bodyResult = bodySchema.validate(req.body, { abortEarly: false });
            if (bodyResult.error) {
                return next(bodyResult.error);
            }
            next();
        };
    },
};

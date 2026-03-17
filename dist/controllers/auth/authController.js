"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const authService_1 = require("../../services/authService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const authService = new authService_1.AuthService();
exports.AuthController = {
    register: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { username, password, role, adminSecret } = req.body;
        if (!username || !password || !role) {
            throw ResponseHandler_1.ResponseHandler.badRequest("username, password, and role are required");
        }
        const result = await authService.register(String(username).trim(), password, role, adminSecret);
        ResponseHandler_1.ResponseHandler.success(res, result, "Registration successful");
    }),
    login: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const username = req.body.username ??
            req.body.name;
        const password = req.body.password;
        if (!username || !password) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Username (or name) and password are required");
        }
        const result = await authService.login(String(username).trim(), password);
        ResponseHandler_1.ResponseHandler.success(res, result, "Login successful");
    }),
};

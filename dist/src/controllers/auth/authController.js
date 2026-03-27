"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const authService_1 = require("../../services/authService");
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const authService = new authService_1.AuthService();
exports.AuthController = {
    register: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { email, password, role, adminSecret } = req.body;
        if (!email || !password || !role) {
            throw ResponseHandler_1.ResponseHandler.badRequest("email, password, and role are required");
        }
        const result = await authService.register(String(email).trim(), password, role, adminSecret);
        ResponseHandler_1.ResponseHandler.success(res, result, "Registration successful");
    }),
    login: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const email = req.body.email;
        const password = req.body.password;
        if (!email || !password) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email and password are required");
        }
        const result = await authService.login(String(email).trim(), password);
        ResponseHandler_1.ResponseHandler.success(res, result, "Login successful");
    }),
    forgotPasswordRequestOtp: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const email = req.body.email;
        if (!email) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email is required");
        }
        const result = await authService.requestForgotPasswordOtp(email);
        ResponseHandler_1.ResponseHandler.success(res, result, "OTP sent successfully");
    }),
    forgotPasswordVerifyOtp: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { email, otp } = req.body;
        if (!email || !otp) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email and OTP are required");
        }
        const result = await authService.verifyForgotPasswordOtp(email, otp);
        ResponseHandler_1.ResponseHandler.success(res, result, "OTP verified successfully");
    }),
    forgotPasswordReset: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const { email, otp, newPassword, confirmNewPassword } = req.body;
        if (!email || !otp || !newPassword || !confirmNewPassword) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Email, OTP, newPassword and confirmNewPassword are required");
        }
        const result = await authService.resetForgotPassword(email, otp, newPassword, confirmNewPassword);
        ResponseHandler_1.ResponseHandler.success(res, result, "Password reset successful");
    }),
};

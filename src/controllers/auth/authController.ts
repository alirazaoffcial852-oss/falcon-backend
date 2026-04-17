import { Request, Response } from "express";
import { AuthService } from "../../services/authService";
import { DriverService } from "../../services/driverService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import type { AuthRequest } from "../../middleware/authMiddleware";

const authService = new AuthService();
const driverService = new DriverService();

export const AuthController = {
	register: catchAsync(async (req: Request, res: Response) => {
		const { email, password, role, adminSecret } = req.body as {
			email?: string;
			password?: string;
			role?: "admin" | "driver" | "passenger";
			adminSecret?: string;
		};
		if (!email || !password || !role) {
			throw ResponseHandler.badRequest(
				"email, password, and role are required",
			);
		}
		const result = await authService.register(
			String(email).trim(),
			password,
			role,
			adminSecret,
		);
		ResponseHandler.success(res, result, "Registration successful");
	}),

	driverRegister: catchAsync(async (req: Request, res: Response) => {
		const result = await driverService.create(
			{ ...req.body },
			{ requesterRole: "driver" },
		);
		ResponseHandler.success(
			res,
			result,
			"Driver registration request submitted for admin approval",
		);
	}),

	login: catchAsync(async (req: Request, res: Response) => {
		const email = (req.body as { email?: string }).email;
		const password = (req.body as { password?: string }).password;
		if (!email || !password) {
			throw ResponseHandler.badRequest("Email and password are required");
		}
		const result = await authService.login(String(email).trim(), password);
		ResponseHandler.success(res, result, "Login successful");
	}),

	logout: catchAsync(async (req: AuthRequest, res: Response) => {
		const userId = req.user?.id ? Number(req.user.id) : null;
		if (!userId) throw ResponseHandler.unauthorized("Not authenticated");
		const { deviceToken } = req.body as { deviceToken?: string };
		if (!deviceToken) {
			throw ResponseHandler.badRequest("deviceToken is required");
		}
		const result = await authService.logout(userId, deviceToken);
		ResponseHandler.success(res, result, "Logout successful");
	}),

	forgotPasswordRequestOtp: catchAsync(async (req: Request, res: Response) => {
		const email = (req.body as { email?: string }).email;
		if (!email) {
			throw ResponseHandler.badRequest("Email is required");
		}
		const result = await authService.requestForgotPasswordOtp(email);
		ResponseHandler.success(res, result, "OTP sent successfully");
	}),

	forgotPasswordVerifyOtp: catchAsync(async (req: Request, res: Response) => {
		const { email, otp } = req.body as { email?: string; otp?: string };
		if (!email || !otp) {
			throw ResponseHandler.badRequest("Email and OTP are required");
		}
		const result = await authService.verifyForgotPasswordOtp(email, otp);
		ResponseHandler.success(res, result, "OTP verified successfully");
	}),

	forgotPasswordReset: catchAsync(async (req: Request, res: Response) => {
		const { email, otp, newPassword, confirmNewPassword } = req.body as {
			email?: string;
			otp?: string;
			newPassword?: string;
			confirmNewPassword?: string;
		};
		if (!email || !otp || !newPassword || !confirmNewPassword) {
			throw ResponseHandler.badRequest(
				"Email, OTP, newPassword and confirmNewPassword are required",
			);
		}
		const result = await authService.resetForgotPassword(
			email,
			otp,
			newPassword,
			confirmNewPassword,
		);
		ResponseHandler.success(res, result, "Password reset successful");
	}),
};

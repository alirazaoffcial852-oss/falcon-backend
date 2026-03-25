import { Request, Response } from "express";
import { AuthService } from "../../services/authService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";

const authService = new AuthService();

export const AuthController = {
	register: catchAsync(async (req: Request, res: Response) => {
		const { username, password, role, adminSecret } = req.body as {
			username?: string;
			password?: string;
			role?: "admin" | "driver" | "passenger";
			adminSecret?: string;
		};
		if (!username || !password || !role) {
			throw ResponseHandler.badRequest(
				"username, password, and role are required",
			);
		}
		// const result = await authService.register(
		// 	String(username).trim(),
		// 	password,
		// 	role,
		// 	adminSecret,
		// );
		// ResponseHandler.success(res, result, "Registration successful");
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
};

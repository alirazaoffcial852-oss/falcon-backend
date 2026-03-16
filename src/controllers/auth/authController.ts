import { Request, Response } from "express";
import { AuthService } from "../../services/authService";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";

const authService = new AuthService();

export const AuthController = {
	login: catchAsync(async (req: Request, res: Response) => {
		const username =
			(req.body as { username?: string }).username ??
			(req.body as { name?: string }).name;
		const password = (req.body as { password?: string }).password;
		if (!username || !password) {
			throw ResponseHandler.badRequest(
				"Username (or name) and password are required",
			);
		}
		const result = await authService.login(
			String(username).trim(),
			password,
		);
		ResponseHandler.success(res, result, "Login successful");
	}),
};

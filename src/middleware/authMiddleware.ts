import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { adminService } from "../services/adminService";
import { AuthRequestUser } from "../types/admin/auth";

export interface AuthRequest extends Request {
  user?: AuthRequestUser;
}

export const authMiddleware = (
	req: AuthRequest,
	res: Response,
	next: NextFunction,
) => {
	const token = req.headers.authorization?.replace("Bearer ", "");
	if (!token) return res.status(401).json({ message: "Unauthorized" });
	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
		req.user = decoded as AuthRequestUser;
		next();
	} catch {
		return res.status(401).json({ message: "Invalid token" });
	}
};

export const roleMiddleware =
	(...roles: string[]) =>
	(req: AuthRequest, res: Response, next: NextFunction) => {
		const isAdmin = req.user?.is_admin_role || req.user?.is_super_admin;
		const isSuperAdmin = req.user?.is_super_admin;

		if (isSuperAdmin) {
			return next();
		}

		if (isAdmin && (roles.includes('admin') || roles.includes('super_admin'))) {
			return next();
		}

		if (!req.user || !roles.includes(req.user.role as string)) {
			return res.status(403).json({ message: "Forbidden" });
		}
		next();
	};

export const permissionMiddleware = (
	module: string,
	action: "view" | "create" | "edit" | "delete"
) => {
	return async (req: AuthRequest, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?.id;

			if (!userId) {
				return res.status(401).json({ message: "Unauthorized" });
			}

			const hasPermission = await adminService.hasPermission(
				Number(userId),
				module as any,
				action
			);

			if (!hasPermission) {
				return res.status(403).json({
					message: `Forbidden: You don't have ${action} permission for ${module}`,
				});
			}

			next();
		} catch (error) {
			return res.status(500).json({ message: "Error checking permissions" });
		}
	};
};

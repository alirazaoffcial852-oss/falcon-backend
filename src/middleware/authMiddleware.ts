import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
	user?: { id?: string; role?: string; [key: string]: unknown };
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
		req.user = decoded as {
			id?: string;
			role?: string;
			[key: string]: unknown;
		};
		next();
	} catch {
		return res.status(401).json({ message: "Invalid token" });
	}
};

export const roleMiddleware =
	(...roles: string[]) =>
	(req: AuthRequest, res: Response, next: NextFunction) => {
		if (!req.user || !roles.includes(req.user.role as string)) {
			return res.status(403).json({ message: "Forbidden" });
		}
		next();
	};

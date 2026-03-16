import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

async function getPermissionsForRole(_roleId: string): Promise<string[]> {
	return [];
}

export const requirePermission =
	(...permissionNames: string[]) =>
	async (req: AuthRequest, res: Response, next: NextFunction) => {
		const roleId = (req.user as { roleId?: string })?.roleId;
		if (!roleId) return res.status(403).json({ message: "Forbidden" });
		const permissions = await getPermissionsForRole(roleId);
		const hasPermission = permissionNames.some((p) => permissions.includes(p));
		if (!hasPermission)
			return res.status(403).json({ message: "Insufficient permissions" });
		next();
	};

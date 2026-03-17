"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermission = void 0;
async function getPermissionsForRole(_roleId) {
    return [];
}
const requirePermission = (...permissionNames) => async (req, res, next) => {
    const roleId = req.user?.roleId;
    if (!roleId)
        return res.status(403).json({ message: "Forbidden" });
    const permissions = await getPermissionsForRole(roleId);
    const hasPermission = permissionNames.some((p) => permissions.includes(p));
    if (!hasPermission)
        return res.status(403).json({ message: "Insufficient permissions" });
    next();
};
exports.requirePermission = requirePermission;

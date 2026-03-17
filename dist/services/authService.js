"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const ResponseHandler_1 = require("../utils/responses/ResponseHandler");
const ROLES = ["admin", "driver", "passenger"];
class AuthService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async ensureRolesExist() {
        for (const name of ROLES) {
            await this.db.role.upsert({
                where: { name },
                create: { name },
                update: {},
            });
        }
    }
    async register(username, password, role, adminSecret) {
        await this.ensureRolesExist();
        const existing = await this.db.user.findUnique({
            where: { username: username.trim() },
        });
        if (existing)
            throw ResponseHandler_1.ResponseHandler.badRequest("Username already taken");
        if (role === "admin") {
            const userCount = await this.db.user.count();
            if (userCount > 0) {
                const secret = process.env.ADMIN_REGISTER_SECRET;
                if (!secret || adminSecret !== secret) {
                    throw ResponseHandler_1.ResponseHandler.forbidden("Creating admin requires ADMIN_REGISTER_SECRET when users already exist.");
                }
            }
        }
        const roleRow = await this.db.role.findUnique({ where: { name: role } });
        if (!roleRow)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid role");
        const hashed = await bcryptjs_1.default.hash(password, 10);
        const user = await this.db.user.create({
            data: {
                username: username.trim(),
                password: hashed,
                role_id: roleRow.id,
            },
            include: { role: true },
        });
        return {
            user: { id: user.id, username: user.username, role: user.role.name },
        };
    }
    async login(usernameOrName, password) {
        const user = await this.db.user.findUnique({
            where: { username: String(usernameOrName).trim() },
            include: { role: true },
        });
        if (!user)
            throw ResponseHandler_1.ResponseHandler.unauthorized("Invalid username or password");
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            throw ResponseHandler_1.ResponseHandler.unauthorized("Invalid username or password");
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw ResponseHandler_1.ResponseHandler.internal("Server misconfiguration");
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role.name }, secret, { expiresIn: "7d" });
        return {
            token,
            user: { id: user.id, username: user.username, role: user.role.name },
        };
    }
}
exports.AuthService = AuthService;

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
const email_1 = require("../utils/email");
const ROLES = ["admin", "driver", "passenger"];
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const forgotPasswordOtpStore = new Map();
class AuthService {
    constructor() {
        this.db = database_1.DatabaseService.getInstance().getPrisma();
    }
    async login(email, password) {
        const user = await this.db.user.findUnique({
            where: { email: String(email).trim().toLowerCase() },
            include: { role: true },
        });
        if (!user)
            throw ResponseHandler_1.ResponseHandler.unauthorized("Invalid email or password");
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid)
            throw ResponseHandler_1.ResponseHandler.unauthorized("Invalid password");
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw ResponseHandler_1.ResponseHandler.internal("Server misconfiguration");
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role.name }, secret, {
            expiresIn: "7d",
        });
        return {
            token,
            user: { id: user.id, email: user.email, role: user.role.name },
        };
    }
    async register(email, password, role, adminSecret) {
        if (role === "admin") {
            const expectedSecret = process.env.ADMIN_SECRET;
            if (!expectedSecret || adminSecret !== expectedSecret) {
                throw ResponseHandler_1.ResponseHandler.unauthorized("Invalid admin secret");
            }
        }
        if (!ROLES.includes(role)) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid role");
        }
        const existingUser = await this.db.user.findUnique({
            where: { email: String(email).trim().toLowerCase() },
        });
        if (existingUser) {
            throw ResponseHandler_1.ResponseHandler.badRequest("User with this email already exists");
        }
        const roleRecord = await this.db.role.findUnique({
            where: { name: role },
        });
        if (!roleRecord) {
            throw ResponseHandler_1.ResponseHandler.internal("Role not found in database");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await this.db.user.create({
            data: {
                email: String(email).trim().toLowerCase(),
                password: hashedPassword,
                role_id: roleRecord.id,
            },
        });
        const secret = process.env.JWT_SECRET;
        if (!secret)
            throw ResponseHandler_1.ResponseHandler.internal("Server misconfiguration");
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: role }, secret, {
            expiresIn: "7d",
        });
        return {
            token,
            user: { id: user.id, email: user.email, role: role },
        };
    }
    async requestForgotPasswordOtp(email) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const user = await this.db.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user)
            throw ResponseHandler_1.ResponseHandler.notFound("No user found against this email");
        const otp = String(Math.floor(1000 + Math.random() * 9000));
        forgotPasswordOtpStore.set(normalizedEmail, {
            otp,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
            verified: false,
        });
        await (0, email_1.sendForgotPasswordOtpEmail)(normalizedEmail, otp);
        return { email: normalizedEmail, expiresInSeconds: OTP_EXPIRY_MS / 1000 };
    }
    async verifyForgotPasswordOtp(email, otp) {
        const normalizedEmail = String(email).trim().toLowerCase();
        const record = forgotPasswordOtpStore.get(normalizedEmail);
        if (!record)
            throw ResponseHandler_1.ResponseHandler.badRequest("OTP not requested");
        if (Date.now() > record.expiresAt) {
            forgotPasswordOtpStore.delete(normalizedEmail);
            throw ResponseHandler_1.ResponseHandler.badRequest("OTP expired");
        }
        if (record.otp !== otp)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid OTP");
        record.verified = true;
        forgotPasswordOtpStore.set(normalizedEmail, record);
        return { email: normalizedEmail, verified: true };
    }
    async resetForgotPassword(email, otp, newPassword, confirmNewPassword) {
        const normalizedEmail = String(email).trim().toLowerCase();
        if (newPassword !== confirmNewPassword) {
            throw ResponseHandler_1.ResponseHandler.badRequest("New password and confirm password must match");
        }
        const record = forgotPasswordOtpStore.get(normalizedEmail);
        if (!record)
            throw ResponseHandler_1.ResponseHandler.badRequest("OTP not requested");
        if (Date.now() > record.expiresAt) {
            forgotPasswordOtpStore.delete(normalizedEmail);
            throw ResponseHandler_1.ResponseHandler.badRequest("OTP expired");
        }
        if (record.otp !== otp)
            throw ResponseHandler_1.ResponseHandler.badRequest("Invalid OTP");
        if (!record.verified) {
            throw ResponseHandler_1.ResponseHandler.badRequest("OTP is not verified");
        }
        const user = await this.db.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user)
            throw ResponseHandler_1.ResponseHandler.notFound("No user found against this email");
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await this.db.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });
        forgotPasswordOtpStore.delete(normalizedEmail);
        return { email: normalizedEmail, passwordReset: true };
    }
}
exports.AuthService = AuthService;

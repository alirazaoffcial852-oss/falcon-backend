import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import { sendForgotPasswordOtpEmail } from "../utils/email";

const ROLES = ["admin", "driver", "passenger"] as const;
const OTP_EXPIRY_MS = 5 * 60 * 1000;

type ForgotPasswordOtpRecord = {
	otp: string;
	expiresAt: number;
	verified: boolean;
};
const forgotPasswordOtpStore = new Map<string, ForgotPasswordOtpRecord>();

export class AuthService {
	private db = DatabaseService.getInstance().getPrisma();

	async login(email: string, password: string) {
		const user = await this.db.user.findUnique({
			where: { email: String(email).trim().toLowerCase() },
			include: { role: true },
		});
		if (!user) throw ResponseHandler.unauthorized("Invalid email or password");
		const valid = await bcrypt.compare(password, user.password);
		if (!valid) throw ResponseHandler.unauthorized("Invalid email or password");
		const secret = process.env.JWT_SECRET;
		if (!secret) throw ResponseHandler.internal("Server misconfiguration");
		const token = jwt.sign({ id: user.id, role: user.role.name }, secret, {
			expiresIn: "7d",
		});
		return {
			token,
			user: { id: user.id, email: user.email, role: user.role.name },
		};
	}

	async register(
		email: string,
		password: string,
		role: "admin" | "driver" | "passenger",
		adminSecret?: string,
	) {
		if (role === "admin") {
			const expectedSecret = process.env.ADMIN_SECRET;
			if (!expectedSecret || adminSecret !== expectedSecret) {
				throw ResponseHandler.unauthorized("Invalid admin secret");
			}
		}

		if (!ROLES.includes(role)) {
			throw ResponseHandler.badRequest("Invalid role");
		}

		const existingUser = await this.db.user.findUnique({
			where: { email: String(email).trim().toLowerCase() },
		});
		if (existingUser) {
			throw ResponseHandler.badRequest("User with this email already exists");
		}

		const roleRecord = await this.db.role.findUnique({
			where: { name: role },
		});
		if (!roleRecord) {
			throw ResponseHandler.internal("Role not found in database");
		}

		const hashedPassword = await bcrypt.hash(password, 10);

		const user = await this.db.user.create({
			data: {
				email: String(email).trim().toLowerCase(),
				password: hashedPassword,
				role_id: roleRecord.id,
			},
		});

		const secret = process.env.JWT_SECRET;
		if (!secret) throw ResponseHandler.internal("Server misconfiguration");
		const token = jwt.sign({ id: user.id, role: role }, secret, {
			expiresIn: "7d",
		});

		return {
			token,
			user: { id: user.id, email: user.email, role: role },
		};
	}

	async requestForgotPasswordOtp(email: string) {
		const normalizedEmail = String(email).trim().toLowerCase();
		const user = await this.db.user.findUnique({
			where: { email: normalizedEmail },
		});
		if (!user)
			throw ResponseHandler.notFound("No user found against this email");
		const otp = String(Math.floor(1000 + Math.random() * 9000));
		forgotPasswordOtpStore.set(normalizedEmail, {
			otp,
			expiresAt: Date.now() + OTP_EXPIRY_MS,
			verified: false,
		});
		await sendForgotPasswordOtpEmail(normalizedEmail, otp);
		return { email: normalizedEmail, expiresInSeconds: OTP_EXPIRY_MS / 1000 };
	}

	async verifyForgotPasswordOtp(email: string, otp: string) {
		const normalizedEmail = String(email).trim().toLowerCase();
		const record = forgotPasswordOtpStore.get(normalizedEmail);
		if (!record) throw ResponseHandler.badRequest("OTP not requested");
		if (Date.now() > record.expiresAt) {
			forgotPasswordOtpStore.delete(normalizedEmail);
			throw ResponseHandler.badRequest("OTP expired");
		}
		if (record.otp !== otp) throw ResponseHandler.badRequest("Invalid OTP");
		record.verified = true;
		forgotPasswordOtpStore.set(normalizedEmail, record);
		return { email: normalizedEmail, verified: true };
	}

	async resetForgotPassword(
		email: string,
		otp: string,
		newPassword: string,
		confirmNewPassword: string,
	) {
		const normalizedEmail = String(email).trim().toLowerCase();
		if (newPassword !== confirmNewPassword) {
			throw ResponseHandler.badRequest(
				"New password and confirm password must match",
			);
		}
		const record = forgotPasswordOtpStore.get(normalizedEmail);
		if (!record) throw ResponseHandler.badRequest("OTP not requested");
		if (Date.now() > record.expiresAt) {
			forgotPasswordOtpStore.delete(normalizedEmail);
			throw ResponseHandler.badRequest("OTP expired");
		}
		if (record.otp !== otp) throw ResponseHandler.badRequest("Invalid OTP");
		if (!record.verified) {
			throw ResponseHandler.badRequest("OTP is not verified");
		}
		const user = await this.db.user.findUnique({
			where: { email: normalizedEmail },
		});
		if (!user)
			throw ResponseHandler.notFound("No user found against this email");
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await this.db.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});
		forgotPasswordOtpStore.delete(normalizedEmail);
		return { email: normalizedEmail, passwordReset: true };
	}
}

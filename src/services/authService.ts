import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const ROLES = ["admin", "driver", "passenger"] as const;

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
}

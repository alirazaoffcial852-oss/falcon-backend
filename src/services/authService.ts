import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";

const ROLES = ["admin", "driver", "passenger"] as const;

export class AuthService {
	private db = DatabaseService.getInstance().getPrisma();

	private async ensureRolesExist() {
		for (const name of ROLES) {
			await this.db.role.upsert({
				where: { name },
				create: { name },
				update: {},
			});
		}
	}

	async register(
		username: string,
		password: string,
		role: "admin" | "driver" | "passenger",
		adminSecret?: string,
	) {
		await this.ensureRolesExist();
		const existing = await this.db.user.findUnique({
			where: { username: username.trim() },
		});
		if (existing) throw ResponseHandler.badRequest("Username already taken");
		if (role === "admin") {
			const userCount = await this.db.user.count();
			if (userCount > 0) {
				const secret = process.env.ADMIN_REGISTER_SECRET;
				if (!secret || adminSecret !== secret) {
					throw ResponseHandler.forbidden(
						"Creating admin requires ADMIN_REGISTER_SECRET when users already exist.",
					);
				}
			}
		}
		const roleRow = await this.db.role.findUnique({ where: { name: role } });
		if (!roleRow) throw ResponseHandler.badRequest("Invalid role");
		const hashed = await bcrypt.hash(password, 10);
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

	async login(usernameOrName: string, password: string) {
		const user = await this.db.user.findUnique({
			where: { username: String(usernameOrName).trim() },
			include: { role: true },
		});
		if (!user) throw ResponseHandler.unauthorized("Invalid username or password");
		const valid = await bcrypt.compare(password, user.password);
		if (!valid) throw ResponseHandler.unauthorized("Invalid username or password");
		const secret = process.env.JWT_SECRET;
		if (!secret) throw ResponseHandler.internal("Server misconfiguration");
		const token = jwt.sign(
			{ id: user.id, role: user.role.name },
			secret,
			{ expiresIn: "7d" },
		);
		return {
			token,
			user: { id: user.id, username: user.username, role: user.role.name },
		};
	}
}

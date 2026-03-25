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
}

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
	// 1) Roles seed
	const roles = [{ name: "admin" }, { name: "driver" }, { name: "passenger" }];
	for (const r of roles) {
		await prisma.role.upsert({
			where: { name: r.name },
			create: r,
			update: {},
		});
	}

	// 2) Admin user (username=admin, password=admin@123)
	const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
	if (!adminRole) throw new Error("Admin role not found");
	const hashedPassword = await bcrypt.hash("admin@123", 10);
	await prisma.user.upsert({
		where: { username: "admin" },
		create: {
			username: "admin",
			password: hashedPassword,
			role_id: adminRole.id,
		},
		update: { password: hashedPassword },
	});

	console.log("Seeded: roles (admin, driver, passenger) and admin user.");
}

main()
	.then(() => prisma.$disconnect())
	.catch((e) => {
		console.error(e);
		prisma.$disconnect();
		process.exit(1);
	});

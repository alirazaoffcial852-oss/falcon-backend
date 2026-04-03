import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding admin user only...");

  console.log("👤 Creating admin role...");
  await prisma.role.upsert({
    where: { name: "admin" },
    create: { name: "admin" },
    update: {},
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) throw new Error("Admin role not found");

  const hashedPassword = await bcrypt.hash("admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@falcon.com" },
    create: {
      email: "admin@falcon.com",
      password: hashedPassword,
      role_id: adminRole.id,
    },
    update: { password: hashedPassword },
  });

  console.log("✅ Admin user seeded successfully!");
  console.log("   Email: admin@falcon.com");
  console.log("   Password: admin@123");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    prisma.$disconnect();
    process.exit(1);
  });

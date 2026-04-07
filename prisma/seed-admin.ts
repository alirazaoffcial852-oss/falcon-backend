import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import * as bcrypt from "bcryptjs";
import { ADMIN_MODULES } from "../src/types/admin/auth";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding super admin user...");

  console.log("👤 Creating super admin role...");
  const superAdminRole = await prisma.role.upsert({
    where: { name: "super_admin" },
    create: {
      name: "super_admin",
      is_admin_role: true,
    },
    update: {},
  });

  console.log("👤 Creating admin role...");
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    create: {
      name: "admin",
      is_admin_role: true,
    },
    update: {},
  });

  console.log("🔐 Creating full permissions for super admin...");
  await prisma.adminPermission.deleteMany({
    where: { role_id: superAdminRole.id },
  });

  await prisma.adminPermission.createMany({
    data: ADMIN_MODULES.map((module) => ({
      role_id: superAdminRole.id,
      module: module,
      can_view: true,
      can_create: true,
      can_edit: true,
      can_delete: true,
    })),
  });

  const hashedPassword = await bcrypt.hash("admin@123", 10);
  await prisma.user.upsert({
    where: { email: "admin@falcon.com" },
    create: {
      email: "admin@falcon.com",
      password: hashedPassword,
      role_id: superAdminRole.id,
      is_super_admin: true,
    },
    update: {
      password: hashedPassword,
      role_id: superAdminRole.id,
      is_super_admin: true,
    },
  });

  console.log("✅ Super admin seeded successfully!");
  console.log("   Email: admin@falcon.com");
  console.log("   Password: admin@123");
  console.log("   Role: super_admin");
  console.log("   Permissions: Full access to all modules");
  console.log("");
  console.log("📋 Available modules with permissions:");
  ADMIN_MODULES.forEach((mod) => {
    console.log(`   ✓ ${mod}: view, create, edit, delete`);
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    prisma.$disconnect();
    process.exit(1);
  });

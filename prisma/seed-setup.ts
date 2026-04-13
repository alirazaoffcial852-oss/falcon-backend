import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import * as bcrypt from "bcryptjs";
import { ADMIN_MODULES } from "../src/types/admin/auth";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up basic database structure...");

  console.log("Creating basic roles...");
  const roles = [
    { name: "super_admin", is_admin_role: true },
    { name: "admin", is_admin_role: true },
    { name: "driver" },
    { name: "passenger" },
    { name: "company" },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: role,
      update: {},
    });
  }

  console.log("Setting up super admin permissions...");
  const superAdminRole = await prisma.role.findUnique({
    where: { name: "super_admin" },
  });

  if (superAdminRole) {
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
  }

  console.log("Creating super admin user...");
  const hashedPassword = await bcrypt.hash("admin@123", 10);

  if (!superAdminRole) {
    throw new Error("Super admin role not found");
  }

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

  console.log("Basic setup completed successfully!");
  console.log("   Email: admin@falcon.com");
  console.log("   Password: admin@123");
  console.log("   Role: super_admin");
  console.log("   Permissions: Full access to all modules");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Basic setup error:", e);
    prisma.$disconnect();
    process.exit(1);
  });

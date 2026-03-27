"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("../src/generated/prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
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
    // 2) Admin user (email=admin@falcon.com, password=admin@123)
    const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
    if (!adminRole)
        throw new Error("Admin role not found");
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
    console.log("Seeded: roles (admin, driver, passenger) and admin user.");
}
main()
    .then(() => prisma.$disconnect())
    .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});

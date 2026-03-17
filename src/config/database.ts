import path from "path";
import type { PrismaClient } from "../generated/prisma/client";

// Runtime path: from dist/config/ we load src/generated (so Vercel/serverless finds the client)
const { PrismaClient: PrismaClientCtor } = require(path.join(
	__dirname,
	"../../src/generated/prisma/client",
));

/**
 * Single-database service for Falcon (non-SaaS).
 * One Prisma instance for the app; no per-client databases.
 */
export class DatabaseService {
	private static instance: DatabaseService;
	private prisma: PrismaClient;

	private constructor() {
		this.prisma = new PrismaClientCtor();
	}

	static getInstance(): DatabaseService {
		if (!DatabaseService.instance) {
			DatabaseService.instance = new DatabaseService();
		}
		return DatabaseService.instance;
	}

	getPrisma(): PrismaClient {
		return this.prisma;
	}

	async disconnectAllClientsConnections(): Promise<void> {
		await this.prisma.$disconnect();
	}
}

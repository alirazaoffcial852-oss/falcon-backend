import { PrismaClient } from "../generated/prisma/client";

/**
 * Single-database service for Falcon (non-SaaS).
 * One Prisma instance for the app; no per-client databases.
 */
export class DatabaseService {
	private static instance: DatabaseService;
	private prisma: PrismaClient;

	private constructor() {
		this.prisma = new PrismaClient();
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

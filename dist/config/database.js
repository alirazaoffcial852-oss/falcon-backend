"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const client_1 = require("../generated/prisma/client");
/**
 * Single-database service for Falcon (non-SaaS).
 * One Prisma instance for the app; no per-client databases.
 */
class DatabaseService {
    constructor() {
        this.prisma = new client_1.PrismaClient();
    }
    static getInstance() {
        if (!DatabaseService.instance) {
            DatabaseService.instance = new DatabaseService();
        }
        return DatabaseService.instance;
    }
    getPrisma() {
        return this.prisma;
    }
    async disconnectAllClientsConnections() {
        await this.prisma.$disconnect();
    }
}
exports.DatabaseService = DatabaseService;

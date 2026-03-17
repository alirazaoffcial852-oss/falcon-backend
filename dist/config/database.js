"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const path_1 = __importDefault(require("path"));
// Runtime path: from dist/config/ we load src/generated (so Vercel/serverless finds the client)
const { PrismaClient: PrismaClientCtor } = require(path_1.default.join(__dirname, "../../src/generated/prisma/client"));
/**
 * Single-database service for Falcon (non-SaaS).
 * One Prisma instance for the app; no per-client databases.
 */
class DatabaseService {
    constructor() {
        this.prisma = new PrismaClientCtor();
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

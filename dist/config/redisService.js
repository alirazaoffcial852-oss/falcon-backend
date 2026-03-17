"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
class RedisService {
    constructor() { }
    static getInstance() {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }
    async disconnect() {
        // Optional: close Redis connection when implemented
    }
}
exports.RedisService = RedisService;

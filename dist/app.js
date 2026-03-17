"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const database_1 = require("./config/database");
const redisService_1 = require("./config/redisService");
const errorHandler_1 = require("./middleware/errorHandler");
const cors_1 = __importDefault(require("cors"));
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const routes_1 = __importDefault(require("./routes"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const swagger_1 = __importDefault(require("./swagger"));
const app = (0, express_1.default)();
exports.app = app;
const httpServer = http_1.default.createServer(app);
app.set("trust proxy", true);
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://192.168.1.22",
    "http://192.168.1.22:5001",
];
// app.use(
// 	cors({
// 		origin: function (origin, callback) {
// 			if (!origin) return callback(null, true);
// 			if (allowedOrigins.indexOf(origin) === -1) {
// 				return callback(new Error("CORS not allowed"), false);
// 			}
// 			return callback(null, true);
// 		},
// 		credentials: true,
// 	})
// );
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        console.log("🔍 Express CORS check - Origin:", origin);
        if (!origin) {
            console.log("✅ Express CORS - Allowing request with no origin");
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) === -1) {
            console.log("❌ Express CORS - Origin not allowed:", origin);
            console.log("📋 Allowed origins:", allowedOrigins);
            return callback(new Error("CORS not allowed"), false);
        }
        console.log("✅ Express CORS - Origin allowed:", origin);
        return callback(null, true);
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, express_fileupload_1.default)({
    limits: { fileSize: 30 * 1024 * 1024 }, // Limit file size to 30MB
    abortOnLimit: true,
}));
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.default));
(0, routes_1.default)(app);
app.use(errorHandler_1.errorHandler);
async function startServer() {
    try {
        const dbService = database_1.DatabaseService.getInstance();
        const PORT = process.env.PORT || 5051;
        const server = httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Socket.IO enabled on port ${PORT}`);
        });
        // Graceful shutdown
        process.on("SIGTERM", async () => {
            console.log("SIGTERM received. Shutting down gracefully...");
            await dbService.disconnectAllClientsConnections();
            await redisService_1.RedisService.getInstance().disconnect();
            server.close(() => {
                console.log("Server closed");
                process.exit(0);
            });
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
app.get("/", (req, res) => {
    res.send("Server is running");
});
app.get("/health", (req, res) => {
    res.status(200).json({ message: "Server is healthy" });
});
if (process.env.VERCEL !== "1") {
    startServer().catch(console.error);
}

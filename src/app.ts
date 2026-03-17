import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { DatabaseService } from "./config/database";
import { RedisService } from "./config/redisService";
import { errorHandler } from "./middleware/errorHandler";
import cors from "cors";
import fileUpload from "express-fileupload";
import Routes from "./routes";
import path from "path";
import http from "http";
import swaggerDocument from "./swagger";

const app = express();
const httpServer = http.createServer(app);

app.set("trust proxy", true);

const allowedOrigins = [
	"http://localhost:3000",
	"http://localhost:3001",
	"http://localhost:3002",
	"http://localhost:5173",
	"http://192.168.1.22",
	"http://192.168.1.22:5001",
	"https://falcon-backend-github.vercel.app",
];
const isAllowedOrigin = (origin: string) =>
	allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");

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

app.use(
	cors({
		origin: function (origin, callback) {
			if (!origin) return callback(null, true);
			if (isAllowedOrigin(origin)) return callback(null, true);
			return callback(new Error("CORS not allowed"), false);
		},
		credentials: true,
	}),
);

app.use(express.json());
app.use(
	fileUpload({
		limits: { fileSize: 30 * 1024 * 1024 }, // Limit file size to 30MB
		abortOnLimit: true,
	}),
);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

Routes(app);

app.use(errorHandler);

async function startServer() {
	try {
		const dbService = DatabaseService.getInstance();

		const PORT = process.env.PORT || 5051;
		const server = httpServer.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
			console.log(`Socket.IO enabled on port ${PORT}`);
		});

		// Graceful shutdown
		process.on("SIGTERM", async () => {
			console.log("SIGTERM received. Shutting down gracefully...");
			await dbService.disconnectAllClientsConnections();
			await RedisService.getInstance().disconnect();
			server.close(() => {
				console.log("Server closed");
				process.exit(0);
			});
		});
	} catch (error) {
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

// Export app for Vercel serverless; only start HTTP server when not on Vercel
export { app };
if (process.env.VERCEL !== "1") {
	startServer().catch(console.error);
}

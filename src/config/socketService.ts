import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { DatabaseService } from "./database";
import { setDriverLiveLocation } from "../utils/liveLocationStore";

let io: SocketIOServer | null = null;
const db = DatabaseService.getInstance().getPrisma();

export function initSocket(httpServer: HttpServer): SocketIOServer {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: "*",
			methods: ["GET", "POST"],
		},
	});

	io.on("connection", (socket: Socket) => {
		console.log(`Socket connected: ${socket.id}`);

		// Driver joins a room named "driver:<driverId>"
		socket.on("join:driver", (driverId: number) => {
			socket.join(`driver:${driverId}`);
			console.log(`Driver ${driverId} joined room`);
		});

		// Passenger joins a room named "passenger:<passengerId>"
		socket.on("join:passenger", (passengerId: number) => {
			socket.join(`passenger:${passengerId}`);
			console.log(`Passenger ${passengerId} joined room`);
		});

		// Admin dashboard joins to receive live locations
		socket.on("join:admin", () => {
			socket.join("admin:dashboard");
		});

		// Driver app pushes live location through socket
		socket.on(
			"driver:location:update",
			async (payload: {
				driverId: number;
				lat: number;
				long: number;
			}) => {
				try {
					const driverId = Number(payload?.driverId);
					const lat = Number(payload?.lat);
					const long = Number(payload?.long);
					if (
						!Number.isFinite(driverId) ||
						!Number.isFinite(lat) ||
						!Number.isFinite(long)
					) {
						socket.emit("driver:location:error", {
							message: "Invalid driverId/lat/long in driver:location:update",
						});
						return;
					}
					const updatedAt = new Date();
					setDriverLiveLocation(driverId, lat, long, updatedAt);
					const route = await db.route.findFirst({
						where: { driver_id: driverId, status: "ONGOING" },
						include: { legs: { select: { passenger_id: true } } },
						orderBy: { id: "desc" },
					});
					const data = { driverId, lat, long, updated_at: updatedAt };
					if (route) {
						const passengerIds = route.legs.map((l) => l.passenger_id);
						emitToPassengers(passengerIds, "driver:location", data);
					}
					emitToDriver(driverId, "driver:location", data);
					emitToAdmins("driver:location", data);
				} catch (error) {
					socket.emit("driver:location:error", {
						message: "Failed to process live location",
					});
				}
			},
		);

		socket.on("disconnect", () => {
			console.log(`Socket disconnected: ${socket.id}`);
		});
	});

	return io;
}

export function getSocket(): SocketIOServer {
	if (!io) throw new Error("Socket.io not initialised. Call initSocket first.");
	return io;
}

/**
 * Emit to a specific driver room
 */
export function emitToDriver(driverId: number, event: string, data: unknown) {
	getSocket().to(`driver:${driverId}`).emit(event, data);
}

/**
 * Emit to a specific passenger room
 */
export function emitToPassenger(passengerId: number, event: string, data: unknown) {
	getSocket().to(`passenger:${passengerId}`).emit(event, data);
}

/**
 * Emit to all passengers of a route (pass their IDs)
 */
export function emitToPassengers(passengerIds: number[], event: string, data: unknown) {
	const socket = getSocket();
	for (const id of passengerIds) {
		socket.to(`passenger:${id}`).emit(event, data);
	}
}

export function emitToAdmins(event: string, data: unknown) {
	getSocket().to("admin:dashboard").emit(event, data);
}

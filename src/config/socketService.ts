import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";

let io: SocketIOServer | null = null;

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

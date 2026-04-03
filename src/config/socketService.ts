import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { DatabaseService } from "./database";
import { setDriverLiveLocation } from "../utils/liveLocationStore";
import { dailyPlanForActiveDayWhere } from "../utils/routeDayScope";

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
			console.log(
				`🚗 [DRIVER][join] socket=${socket.id} room=driver:${driverId}`,
			);
		});

		// Passenger joins a room named "passenger:<passengerId>"
		socket.on("join:passenger", (passengerId: number) => {
			socket.join(`passenger:${passengerId}`);
			console.log(
				`🧍 [PASSENGER][join] socket=${socket.id} room=passenger:${passengerId}`,
			);
		});

		// Admin dashboard joins to receive live locations
		socket.on("join:admin", () => {
			socket.join("admin:dashboard");
			console.log(`🛡️ [ADMIN][join] socket=${socket.id} room=admin:dashboard`);
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
					console.log(
						`📍 [DRIVER][location:update] driver=${driverId} lat=${lat} long=${long} at=${updatedAt.toISOString()}`,
					);
					const route = await db.route.findFirst({
						where: {
							driver_id: driverId,
							route_daily_plan_id: { not: null },
							daily_plan: {
								status: "ONGOING",
								...dailyPlanForActiveDayWhere(),
							},
						},
						include: { legs: { select: { passenger_id: true } } },
						orderBy: { id: "desc" },
					});
					const data = { driverId, lat, long, updated_at: updatedAt };
					if (route) {
						const passengerIds = route.legs.map((l) => l.passenger_id);
						console.log(
							`🧍📡 [PASSENGER][emit] event=driver:location route=${route.id} passengers=${passengerIds.join(",")} driver=${driverId} lat=${lat} long=${long}`,
						);
						emitToPassengers(passengerIds, "driver:location", data);
					} else {
						console.log(
							`🧍⚠️ [PASSENGER][emit:skip] no ONGOING route driver=${driverId} lat=${lat} long=${long}`,
						);
					}
					console.log(
						`🚗📡 [DRIVER][emit] event=driver:location room=driver:${driverId} lat=${lat} long=${long}`,
					);
					emitToDriver(driverId, "driver:location", data);
					console.log(
						`🛡️📡 [ADMIN][emit] event=driver:location room=admin:dashboard driver=${driverId} lat=${lat} long=${long}`,
					);
					emitToAdmins("driver:location", data);
				} catch (error) {
					console.error(
						`❌ [DRIVER][location:error] socket=${socket.id} message=Failed to process live location`,
						error,
					);
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

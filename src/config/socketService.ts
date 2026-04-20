import { Server as SocketIOServer, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { DatabaseService } from "./database";
import { setDriverLiveLocation } from "../utils/liveLocationStore";
import { dailyPlanForActiveDayWhere } from "../utils/routeDayScope";

let io: SocketIOServer | null = null;
const db = DatabaseService.getInstance().getPrisma();

export function initSocket(httpServer: HttpServer): SocketIOServer {
	console.log("[Socket] Initializing Socket.IO server...");

	try {
		io = new SocketIOServer(httpServer, {
			cors: {
				origin: "*",
				methods: ["GET", "POST"],
			},
			pingTimeout: 60000,
			pingInterval: 25000,
		});

		console.log("[Socket] Socket.IO server initialized");
	} catch (error) {
		console.error("[Socket] Error initializing Socket.IO server:", error);
		throw error;
	}

	io.on("connection", (socket: Socket) => {
		console.log(
			`[Socket] Client connected: ${socket.id} (Total: ${io?.sockets.sockets.size || 0})`,
		);

		socket.on("join:driver", (driverId: number) => {
			socket.join(`driver:${driverId}`);
			console.log(
				`🚗 [DRIVER][join] socket=${socket.id} room=driver:${driverId}`,
			);
		});

		socket.on("join:passenger", (passengerId: number) => {
			socket.join(`passenger:${passengerId}`);
			console.log(
				`🧍 [PASSENGER][join] socket=${socket.id} room=passenger:${passengerId}`,
			);
		});

		socket.on("join:admin", () => {
			socket.join("admin:dashboard");
			console.log(`🛡️ [ADMIN][join] socket=${socket.id} room=admin:dashboard`);
			socket.emit("admin:joined", { success: true, socketId: socket.id });
		});

		socket.on("leave:admin", () => {
			socket.leave("admin:dashboard");
			console.log(`🛡️ [ADMIN][leave] socket=${socket.id} room=admin:dashboard`);
		});

		// Driver app pushes live location through socket
		socket.on(
			"driver:location:update",
			async (payload: { driverId: number; lat: number; long: number }) => {
				try {
					const rawDriverId = Number(payload?.driverId);
					const lat = Number(payload?.lat);
					const long = Number(payload?.long);
					if (
						!Number.isFinite(rawDriverId) ||
						!Number.isFinite(lat) ||
						!Number.isFinite(long)
					) {
						socket.emit("driver:location:error", {
							message: "Invalid driverId/lat/long in driver:location:update",
						});
						return;
					}

					let driverId = rawDriverId;
					let driverDetails: {
						id: number;
						user_id: number | null;
						name: string;
						phone_no: string | null;
						user: { email: string } | null;
					} | null = null;

					try {
						const resolvedByUserId = await db.driver.findFirst({
							where: { user_id: rawDriverId },
							select: { id: true },
						});
						if (resolvedByUserId) {
							driverId = resolvedByUserId.id;
							console.log(
								`🔄 [DRIVER][id:resolve] user_id=${rawDriverId} → driver.id=${driverId}`,
							);
						}

						driverDetails = await db.driver.findFirst({
							where: {
								OR: [
									{ id: driverId },
									{ id: rawDriverId },
									{ user_id: rawDriverId },
									{ user_id: driverId },
								],
							},
							select: {
								id: true,
								user_id: true,
								name: true,
								phone_no: true,
								user: {
									select: { email: true },
								},
							},
						});

						if (driverDetails) {
							driverId = driverDetails.id;
						}

						if (!driverDetails) {
							const routeDriver = await db.route.findFirst({
								where: {
									OR: [
										{ driver_id: rawDriverId },
										{ driver: { user_id: rawDriverId } },
									],
								},
								orderBy: { id: "desc" },
								select: {
									driver: {
										select: {
											id: true,
											user_id: true,
											name: true,
											phone_no: true,
											user: { select: { email: true } },
										},
									},
								},
							});

							if (routeDriver?.driver) {
								driverDetails = routeDriver.driver;
								driverId = routeDriver.driver.id;
								console.log(
									`🔄 [DRIVER][id:resolve:route] payload=${rawDriverId} → driver.id=${driverId}`,
								);
							}
						}
					} catch (lookupErr) {
						console.warn(
							`⚠️ [DRIVER][id:resolve] Failed to resolve payload driverId=${rawDriverId}, using as-is:`,
							lookupErr,
						);
					}
					// ------------------------------------

					const updatedAt = new Date();
					setDriverLiveLocation(driverId, lat, long, updatedAt);

					const fallbackUser =
						!driverDetails && Number.isFinite(rawDriverId)
							? await db.user.findUnique({
									where: { id: rawDriverId },
									select: { email: true },
								})
							: null;

					if (!driverDetails && !fallbackUser) {
						console.warn(
							`⚠️ [DRIVER][details:missing] payload.driverId=${rawDriverId} resolved.driverId=${driverId} -> no matching driver/user found`,
						);
					}

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

					const data = {
						driverId,
						lat,
						long,
						updated_at: updatedAt,
						driver_name: driverDetails?.name ?? null,
						driver_phone_no: driverDetails?.phone_no ?? null,
						driver_email:
							driverDetails?.user?.email ?? fallbackUser?.email ?? null,
						user_id:
							driverDetails?.user_id ?? (fallbackUser ? rawDriverId : null),
					};

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

		socket.on("disconnect", (reason) => {
			console.log(
				`[Socket] Client disconnected: ${socket.id} (Reason: ${reason}, Remaining: ${io?.sockets.sockets.size || 0})`,
			);
		});
	});

	return io;
}

export function getSocket(): SocketIOServer {
	if (!io) throw new Error("Socket.io not initialised. Call initSocket first.");
	return io;
}

export function emitToDriver(driverId: number, event: string, data: unknown) {
	getSocket().to(`driver:${driverId}`).emit(event, data);
}

export function emitToPassenger(
	passengerId: number,
	event: string,
	data: unknown,
) {
	getSocket().to(`passenger:${passengerId}`).emit(event, data);
}

export function emitToPassengers(
	passengerIds: number[],
	event: string,
	data: unknown,
) {
	const socket = getSocket();
	for (const id of passengerIds) {
		socket.to(`passenger:${id}`).emit(event, data);
	}
}

export function emitToAdmins(event: string, data: unknown) {
	getSocket().to("admin:dashboard").emit(event, data);
}

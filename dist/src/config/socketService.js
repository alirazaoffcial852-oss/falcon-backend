"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getSocket = getSocket;
exports.emitToDriver = emitToDriver;
exports.emitToPassenger = emitToPassenger;
exports.emitToPassengers = emitToPassengers;
exports.emitToAdmins = emitToAdmins;
const socket_io_1 = require("socket.io");
const database_1 = require("./database");
const liveLocationStore_1 = require("../utils/liveLocationStore");
let io = null;
const db = database_1.DatabaseService.getInstance().getPrisma();
function initSocket(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    io.on("connection", (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // Driver joins a room named "driver:<driverId>"
        socket.on("join:driver", (driverId) => {
            socket.join(`driver:${driverId}`);
            console.log(`Driver ${driverId} joined room`);
        });
        // Passenger joins a room named "passenger:<passengerId>"
        socket.on("join:passenger", (passengerId) => {
            socket.join(`passenger:${passengerId}`);
            console.log(`Passenger ${passengerId} joined room`);
        });
        // Admin dashboard joins to receive live locations
        socket.on("join:admin", () => {
            socket.join("admin:dashboard");
        });
        // Driver app pushes live location through socket
        socket.on("driver:location:update", async (payload) => {
            try {
                const driverId = Number(payload?.driverId);
                const lat = Number(payload?.lat);
                const long = Number(payload?.long);
                if (!Number.isFinite(driverId) ||
                    !Number.isFinite(lat) ||
                    !Number.isFinite(long)) {
                    socket.emit("driver:location:error", {
                        message: "Invalid driverId/lat/long in driver:location:update",
                    });
                    return;
                }
                const updatedAt = new Date();
                (0, liveLocationStore_1.setDriverLiveLocation)(driverId, lat, long, updatedAt);
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
            }
            catch (error) {
                socket.emit("driver:location:error", {
                    message: "Failed to process live location",
                });
            }
        });
        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return io;
}
function getSocket() {
    if (!io)
        throw new Error("Socket.io not initialised. Call initSocket first.");
    return io;
}
/**
 * Emit to a specific driver room
 */
function emitToDriver(driverId, event, data) {
    getSocket().to(`driver:${driverId}`).emit(event, data);
}
/**
 * Emit to a specific passenger room
 */
function emitToPassenger(passengerId, event, data) {
    getSocket().to(`passenger:${passengerId}`).emit(event, data);
}
/**
 * Emit to all passengers of a route (pass their IDs)
 */
function emitToPassengers(passengerIds, event, data) {
    const socket = getSocket();
    for (const id of passengerIds) {
        socket.to(`passenger:${id}`).emit(event, data);
    }
}
function emitToAdmins(event, data) {
    getSocket().to("admin:dashboard").emit(event, data);
}

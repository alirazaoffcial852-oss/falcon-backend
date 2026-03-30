"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocket = initSocket;
exports.getSocket = getSocket;
exports.emitToDriver = emitToDriver;
exports.emitToPassenger = emitToPassenger;
exports.emitToPassengers = emitToPassengers;
const socket_io_1 = require("socket.io");
let io = null;
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

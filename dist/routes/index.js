"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Routes;
const express_1 = require("express");
const authRoutes_1 = __importDefault(require("./auth/authRoutes"));
const companyRoutes_1 = __importDefault(require("./admin/companyRoutes"));
const driverRoutes_1 = __importDefault(require("./admin/driverRoutes"));
const passengerRoutes_1 = __importDefault(require("./admin/passengerRoutes"));
const carRoutes_1 = __importDefault(require("./admin/carRoutes"));
const driverConfigurationRoutes_1 = __importDefault(require("./admin/driverConfigurationRoutes"));
const routeRoutes_1 = __importDefault(require("./admin/routeRoutes"));
const uploadRoutes_1 = __importDefault(require("./admin/uploadRoutes"));
const authMiddleware_1 = require("../middleware/authMiddleware");
function Routes(app) {
    const router = (0, express_1.Router)();
    router.use("/auth", authRoutes_1.default);
    const admin = [authMiddleware_1.authMiddleware, (0, authMiddleware_1.roleMiddleware)("admin")];
    router.use("/companies", ...admin, companyRoutes_1.default);
    router.use("/drivers", ...admin, driverRoutes_1.default);
    router.use("/passengers", ...admin, passengerRoutes_1.default);
    router.use("/cars", ...admin, carRoutes_1.default);
    router.use("/driver-configurations", ...admin, driverConfigurationRoutes_1.default);
    router.use("/routes", ...admin, routeRoutes_1.default);
    router.use("/uploads", ...admin, uploadRoutes_1.default);
    app.use("/f1", router);
}

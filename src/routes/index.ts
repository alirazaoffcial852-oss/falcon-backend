import { Express, Router } from "express";
import authRoutes from "./auth/authRoutes";
import companyRoutes from "./admin/companyRoutes";
import driverRoutes from "./admin/driverRoutes";
import passengerRoutes from "./admin/passengerRoutes";
import carRoutes from "./admin/carRoutes";
import driverConfigurationRoutes from "./admin/driverConfigurationRoutes";
import routeRoutes from "./admin/routeRoutes";
import uploadRoutes from "./admin/uploadRoutes";

import { authMiddleware, roleMiddleware } from "../middleware/authMiddleware";

export default function Routes(app: Express) {
	const router = Router();

	router.use("/auth", authRoutes);

	const admin = [authMiddleware, roleMiddleware("admin")];
	router.use("/companies", ...admin, companyRoutes);
	router.use("/drivers", ...admin, driverRoutes);
	router.use("/passengers", ...admin, passengerRoutes);
	router.use("/cars", ...admin, carRoutes);
	router.use("/driver-configurations", ...admin, driverConfigurationRoutes);
	router.use("/routes", ...admin, routeRoutes);
	router.use("/uploads", ...admin, uploadRoutes);

	app.use("/f1", router);
}

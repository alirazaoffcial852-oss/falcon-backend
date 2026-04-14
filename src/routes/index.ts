import { Express, Router } from "express";
import authRoutes from "./auth/authRoutes";
import companyRoutes from "./admin/companyRoutes";
import driverRoutes from "./admin/driverRoutes";
import passengerRoutes from "./admin/passengerRoutes";
import carRoutes from "./admin/carRoutes";
import driverConfigurationRoutes from "./admin/driverConfigurationRoutes";
import routeRoutes from "./admin/routeRoutes";
import uploadRoutes from "./admin/uploadRoutes";
import mobileDriverRoutes from "./mobile/mobileDriverRoutes";
import mobilePassengerRoutes from "./mobile/mobilePassengerRoutes";
import mobileNotificationRoutes from "./mobile/mobileNotificationRoutes";
import scheduleRoutes from "./admin/scheduleRoutes";
import adminRoutes from "./admin/adminRoutes";
import fuelPriceRoutes from "./admin/fuelPriceRoutes";
import payrollRoutes from "./admin/payrollRoutes";

import {
	authMiddleware,
	roleMiddleware,
	permissionMiddleware,
} from "../middleware/authMiddleware";

export default function Routes(app: Express) {
	const router = Router();

	router.use("/auth", authRoutes);

	// Admin routes (require admin role)
	const admin = [authMiddleware, roleMiddleware("admin")];
	const authOnly = [authMiddleware];
	router.use("/companies", ...admin, companyRoutes);
	router.use("/drivers", ...authOnly, driverRoutes);
	router.use("/passengers", ...admin, passengerRoutes);

	router.use("/cars", ...admin, carRoutes);

	router.use("/driver-configurations", ...admin, driverConfigurationRoutes);

	router.use("/routes", ...admin, routeRoutes);

	router.use("/schedule", ...authOnly, scheduleRoutes);

	// router.use("/uploads", ...admin, uploadRoutes);

	router.use("/admins", ...admin, adminRoutes);
	router.use("/fuel-prices", ...admin, fuelPriceRoutes);
	router.use("/payroll", ...admin, payrollRoutes);
	// Public for pre-login flows (e.g. driver self-registration image upload)
	router.use("/uploads", uploadRoutes);

	const mobile = [authMiddleware];
	router.use("/mobile/driver", ...mobile, mobileDriverRoutes);
	router.use("/mobile/passenger", ...mobile, mobilePassengerRoutes);
	router.use("/mobile/notifications", ...mobile, mobileNotificationRoutes);

	app.use("/f1", router);
}

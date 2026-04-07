import express from "express";
import { DriverController } from "../../controllers/driver/driverController";
import { validate } from "../../middleware/validation/validate";
import {
	createDriverSchema,
	updateDriverSchema,
	driverIdParamSchema,
} from "../../schemas/driver/driverSchema";
import { roleMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

router.get(
	"/create-requests",
	roleMiddleware("admin"),
	DriverController.listCreateRequests,
);
router.get("/", roleMiddleware("admin"), DriverController.list);
router.get(
	"/:id",
	roleMiddleware("admin"),
	validate.params(driverIdParamSchema),
	DriverController.getById,
);
router.post(
	"/",
	roleMiddleware("admin", "driver"),
	validate.body(createDriverSchema),
	DriverController.create,
);
router.post(
	"/create-requests/:id/approve",
	roleMiddleware("admin"),
	validate.params(driverIdParamSchema),
	DriverController.approveCreateRequest,
);
router.put(
	"/:id",
	roleMiddleware("admin"),
	validate.combined(updateDriverSchema, driverIdParamSchema),
	DriverController.update,
);
router.delete(
	"/:id",
	roleMiddleware("admin"),
	validate.params(driverIdParamSchema),
	DriverController.delete,
);

export default router;

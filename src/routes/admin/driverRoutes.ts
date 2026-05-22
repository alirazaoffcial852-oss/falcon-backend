import express from "express";
import { DriverController } from "../../controllers/driver/driverController";
import { validate } from "../../middleware/validation/validate";
import {
	createDriverSchema,
	updateDriverSchema,
	driverIdParamSchema,
	approveDriverCreateRequestBodySchema,
} from "../../schemas/driver/driverSchema";
import {
	grantAvailabilityOverrideSchema,
	availabilityMissedQuerySchema,
	stillWaitingQuerySchema,
} from "../../schemas/driver/driverAvailabilitySchema";
import { roleMiddleware } from "../../middleware/authMiddleware";

const router = express.Router();

router.get(
	"/create-requests",
	roleMiddleware("admin"),
	DriverController.listCreateRequests,
);
router.get(
	"/availability-missed",
	roleMiddleware("admin"),
	validate.query(availabilityMissedQuerySchema),
	DriverController.listAvailabilityMissed,
);
router.get(
	"/still-waiting",
	roleMiddleware("admin"),
	validate.query(stillWaitingQuerySchema),
	DriverController.listStillWaiting,
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
	validate.combined(approveDriverCreateRequestBodySchema, driverIdParamSchema),
	DriverController.approveCreateRequest,
);
router.put(
	"/:id",
	roleMiddleware("admin"),
	validate.combined(updateDriverSchema, driverIdParamSchema),
	DriverController.update,
);
router.post(
	"/:id/availability-override",
	roleMiddleware("admin"),
	validate.combined(grantAvailabilityOverrideSchema, driverIdParamSchema),
	DriverController.grantAvailabilityOverride,
);
router.delete(
	"/:id",
	roleMiddleware("admin"),
	validate.params(driverIdParamSchema),
	DriverController.delete,
);

export default router;

import express from "express";
import { DriverController } from "../../controllers/driver/driverController";
import { validate } from "../../middleware/validation/validate";
import {
	createDriverSchema,
	updateDriverSchema,
	driverIdParamSchema,
} from "../../schemas/driver/driverSchema";

const router = express.Router();

router.get("/", DriverController.list);
router.get(
	"/:id",
	validate.params(driverIdParamSchema),
	DriverController.getById,
);
router.post("/", validate.body(createDriverSchema), DriverController.create);
router.put(
	"/:id",
	validate.combined(updateDriverSchema, driverIdParamSchema),
	DriverController.update,
);
router.delete(
	"/:id",
	validate.params(driverIdParamSchema),
	DriverController.delete,
);

export default router;

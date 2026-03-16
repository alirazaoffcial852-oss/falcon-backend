import express from "express";
import { DriverConfigurationController } from "../../controllers/driverConfiguration/driverConfigurationController";
import { validate } from "../../middleware/validation/validate";
import {
	createDriverConfigurationSchema,
	updateDriverConfigurationSchema,
} from "../../schemas/driverConfiguration/driverConfigurationSchema";

const router = express.Router();

router.get("/", DriverConfigurationController.get);
router.post(
	"/",
	validate.body(createDriverConfigurationSchema),
	DriverConfigurationController.create,
);
router.put(
	"/:id",
	validate.body(updateDriverConfigurationSchema),
	DriverConfigurationController.update,
);

export default router;

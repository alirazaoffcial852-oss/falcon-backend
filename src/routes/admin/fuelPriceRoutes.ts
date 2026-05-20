import express from "express";
import { FuelPriceController } from "../../controllers/fuelPrice/fuelPriceController";
import { validate } from "../../middleware/validation/validate";
import {
	createFuelPriceSchema,
	fuelPriceIdParamSchema,
	updateFuelPriceSchema,
} from "../../schemas/fuelPrice/fuelPriceSchema";

const router = express.Router();

router.get("/current", FuelPriceController.getCurrent);
router.get("/", FuelPriceController.list);
router.post("/", validate.body(createFuelPriceSchema), FuelPriceController.create);
router.put(
	"/:id",
	validate.combined(updateFuelPriceSchema, fuelPriceIdParamSchema),
	FuelPriceController.update,
);
router.delete("/:id", validate.params(fuelPriceIdParamSchema), FuelPriceController.delete);

export default router;

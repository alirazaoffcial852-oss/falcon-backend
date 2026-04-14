import express from "express";
import { FuelPriceController } from "../../controllers/fuelPrice/fuelPriceController";
import { validate } from "../../middleware/validation/validate";
import { createFuelPriceSchema } from "../../schemas/fuelPrice/fuelPriceSchema";

const router = express.Router();

router.get("/current", FuelPriceController.getCurrent);
router.get("/", FuelPriceController.list);
router.post("/", validate.body(createFuelPriceSchema), FuelPriceController.create);

export default router;

import express from "express";
import { CarController } from "../../controllers/car/carController";
import { validate } from "../../middleware/validation/validate";
import {
	createCarSchema,
	updateCarSchema,
	carIdParamSchema,
} from "../../schemas/car/carSchema";

const router = express.Router();

router.get("/", CarController.list);
router.get("/:id", validate.params(carIdParamSchema), CarController.getById);
router.post("/", validate.body(createCarSchema), CarController.create);
router.put(
	"/:id",
	validate.combined(updateCarSchema, carIdParamSchema),
	CarController.update,
);
router.delete("/:id", validate.params(carIdParamSchema), CarController.delete);

export default router;

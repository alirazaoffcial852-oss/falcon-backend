import express from "express";
import { PassengerController } from "../../controllers/passenger/passengerController";
import { validate } from "../../middleware/validation/validate";
import {
	createPassengerSchema,
	updatePassengerSchema,
	passengerIdParamSchema,
} from "../../schemas/passenger/passengerSchema";

const router = express.Router();

router.get("/", PassengerController.list);
router.get("/:id", validate.params(passengerIdParamSchema), PassengerController.getById);
router.post("/", validate.body(createPassengerSchema), PassengerController.create);
router.patch(
	"/:id",
	validate.combined(updatePassengerSchema, passengerIdParamSchema),
	PassengerController.update,
);
router.delete("/:id", validate.params(passengerIdParamSchema), PassengerController.delete);

export default router;

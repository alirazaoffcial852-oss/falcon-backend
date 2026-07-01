import express from "express";
import { ExtraRideController } from "../../controllers/extraRide/extraRideController";
import { validate } from "../../middleware/validation/validate";
import {
	createExtraRideBodySchema,
	extraRideHistoryQuerySchema,
} from "../../schemas/extraRide/extraRideSchema";

const router = express.Router();

router.post(
	"/",
	validate.body(createExtraRideBodySchema),
	ExtraRideController.create,
);
router.get(
	"/history",
	validate.query(extraRideHistoryQuerySchema),
	ExtraRideController.listHistory,
);

export default router;

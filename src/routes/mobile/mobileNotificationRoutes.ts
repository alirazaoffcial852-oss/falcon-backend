import { Router } from "express";
import { MobileNotificationController } from "../../controllers/mobile/mobileNotificationController";
import { validate } from "../../middleware/validation/validate";
import {
	registerDeviceTokenSchema,
	unregisterDeviceTokenSchema,
} from "../../schemas/notification/notificationSchema";

const router = Router();

router.post(
	"/device/register",
	validate.body(registerDeviceTokenSchema),
	MobileNotificationController.registerDevice,
);
router.post(
	"/device/unregister",
	validate.body(unregisterDeviceTokenSchema),
	MobileNotificationController.unregisterDevice,
);
router.get("/history", MobileNotificationController.getHistory);
router.post("/history/:id/read", MobileNotificationController.markAsRead);

export default router;


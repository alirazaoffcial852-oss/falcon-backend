import { Router } from "express";
import { MobilePassengerController } from "../../controllers/mobile/mobilePassengerController";

const router = Router();

// Get current session: driver status, ETA, car info, leg state
router.get("/session", MobilePassengerController.getSession);

// Get driver's live location for map tracking
router.get("/driver/location", MobilePassengerController.getDriverLocation);

// Passenger responds when driver has arrived: OK I'm Coming / I'm not Coming
router.post("/session/:routeId/ack", MobilePassengerController.acknowledgeArrival);

export default router;

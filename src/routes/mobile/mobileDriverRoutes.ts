import { Router } from "express";
import { MobileDriverController } from "../../controllers/mobile/mobileDriverController";

const router = Router();

// Driver goes available (slide to go available)
router.post("/available", MobileDriverController.goAvailable);

// Get current session + passenger queue sorted by nearest
router.get("/session", MobileDriverController.getSession);

// Start trip for a route
router.post("/session/:routeId/start", MobileDriverController.startTrip);

// Update driver's live GPS location
router.patch("/location", MobileDriverController.updateLocation);

// Driver arrived at a passenger's pickup point ("I am Here")
router.post("/session/:routeId/legs/:legId/arrive", MobileDriverController.arriveAtPassenger);

// Driver action on a leg: PICKED | STILL_WAITING | MOVE_TO_NEXT
router.post("/session/:routeId/legs/:legId/action", MobileDriverController.legAction);

// Complete the trip (all passengers at office)
router.post("/session/:routeId/complete", MobileDriverController.completeTrip);

export default router;

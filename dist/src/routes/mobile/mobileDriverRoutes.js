"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mobileDriverController_1 = require("../../controllers/mobile/mobileDriverController");
const router = (0, express_1.Router)();
// Driver goes available (slide to go available)
router.post("/available", mobileDriverController_1.MobileDriverController.goAvailable);
// Get current session + passenger queue sorted by nearest
router.get("/session", mobileDriverController_1.MobileDriverController.getSession);
// Start trip for a route
router.post("/session/:routeId/start", mobileDriverController_1.MobileDriverController.startTrip);
// Update driver's live GPS location
router.patch("/location", mobileDriverController_1.MobileDriverController.updateLocation);
// Driver arrived at a passenger's pickup point ("I am Here")
router.post("/session/:routeId/legs/:legId/arrive", mobileDriverController_1.MobileDriverController.arriveAtPassenger);
// Driver action on a leg: PICKED | STILL_WAITING | MOVE_TO_NEXT
router.post("/session/:routeId/legs/:legId/action", mobileDriverController_1.MobileDriverController.legAction);
// After a pickup batch, driver reached office — advance to next pickup or drop segment
router.post("/session/:routeId/office-checkpoint", mobileDriverController_1.MobileDriverController.officeCheckpoint);
// Optional explicit complete when all segments done (usually auto-completes after last drop)
router.post("/session/:routeId/complete", mobileDriverController_1.MobileDriverController.completeTrip);
exports.default = router;

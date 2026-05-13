import { Router } from "express";
import { MobileDriverController } from "../../controllers/mobile/mobileDriverController";

const router = Router();

// Driver goes available (slide to go available)
router.post("/available", MobileDriverController.goAvailable);
router.get("/leaves", MobileDriverController.getMyLeaves);
router.get("/stats", MobileDriverController.getStats);

// Today's phase rows for this driver (PICKUP + DROP, scheduled_date = local today, sorted by trip_start_time)
router.get("/session", MobileDriverController.getSession);
router.get("/cars", MobileDriverController.getMyCars);

// Start PICKUP trip — use `phase_driver_id` from GET /session (RouteDailyPlanPhaseDriver)
router.post("/session/:phaseDriverId/start", MobileDriverController.startTrip);

// Update driver's live GPS location
router.patch("/location", MobileDriverController.updateLocation);

// Arrive — `phase_passenger_id` = phase_passengers[].id from GET /session (not phase_driver_id, not leg id)
router.post(
	"/session/phase-passengers/:phasePassengerId/arrive",
	MobileDriverController.arriveAtPassenger,
);

router.post(
	"/session/phase-passengers/:phasePassengerId/drop",
	MobileDriverController.dropPassenger,
);

// Driver action — body { action }; updates RouteDailyPlanPhasePassenger by phase_passengers[].id
router.post(
	"/session/phase-passengers/:phasePassengerId/action",
	MobileDriverController.legAction,
);

// After a pickup batch, driver reached office — advance to next pickup or drop segment
router.post(
	"/session/:routeId/office-checkpoint",
	MobileDriverController.officeCheckpoint,
);

// Phase complete — PICKUP id: pickup-only sync + phase COMPLETED (plan stays ONGOING). DROP id: full sync + plan COMPLETED when pickup already done. :phaseDriverId = RouteDailyPlanPhaseDriver.id from GET /session
router.post(
	"/session/:phaseDriverId/complete",
	MobileDriverController.completeTrip,
);

// Driver can report protest/blockage/etc while actively driving on this route
router.post(
	"/session/:routeId/issue-report",
	MobileDriverController.reportRouteIssue,
);

export default router;

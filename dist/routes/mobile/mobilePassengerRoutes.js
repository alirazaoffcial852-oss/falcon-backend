"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mobilePassengerController_1 = require("../../controllers/mobile/mobilePassengerController");
const router = (0, express_1.Router)();
// Get current session: driver status, ETA, car info, leg state
router.get("/session", mobilePassengerController_1.MobilePassengerController.getSession);
// Get driver's live location for map tracking
router.get("/driver/location", mobilePassengerController_1.MobilePassengerController.getDriverLocation);
// Passenger responds when driver has arrived: OK I'm Coming / I'm not Coming
router.post("/session/:routeId/ack", mobilePassengerController_1.MobilePassengerController.acknowledgeArrival);
exports.default = router;

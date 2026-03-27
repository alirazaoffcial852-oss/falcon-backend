"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const passengerController_1 = require("../../controllers/passenger/passengerController");
const validate_1 = require("../../middleware/validation/validate");
const passengerSchema_1 = require("../../schemas/passenger/passengerSchema");
const router = express_1.default.Router();
router.get("/", passengerController_1.PassengerController.list);
router.get("/:id", validate_1.validate.params(passengerSchema_1.passengerIdParamSchema), passengerController_1.PassengerController.getById);
router.post("/", validate_1.validate.body(passengerSchema_1.createPassengerSchema), passengerController_1.PassengerController.create);
router.patch("/:id", validate_1.validate.combined(passengerSchema_1.updatePassengerSchema, passengerSchema_1.passengerIdParamSchema), passengerController_1.PassengerController.update);
router.delete("/:id", validate_1.validate.params(passengerSchema_1.passengerIdParamSchema), passengerController_1.PassengerController.delete);
exports.default = router;

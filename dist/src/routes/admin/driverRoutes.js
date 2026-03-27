"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const driverController_1 = require("../../controllers/driver/driverController");
const validate_1 = require("../../middleware/validation/validate");
const driverSchema_1 = require("../../schemas/driver/driverSchema");
const router = express_1.default.Router();
router.get("/", driverController_1.DriverController.list);
router.get("/:id", validate_1.validate.params(driverSchema_1.driverIdParamSchema), driverController_1.DriverController.getById);
router.post("/", validate_1.validate.body(driverSchema_1.createDriverSchema), driverController_1.DriverController.create);
router.put("/:id", validate_1.validate.combined(driverSchema_1.updateDriverSchema, driverSchema_1.driverIdParamSchema), driverController_1.DriverController.update);
router.delete("/:id", validate_1.validate.params(driverSchema_1.driverIdParamSchema), driverController_1.DriverController.delete);
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const driverConfigurationController_1 = require("../../controllers/driverConfiguration/driverConfigurationController");
const validate_1 = require("../../middleware/validation/validate");
const driverConfigurationSchema_1 = require("../../schemas/driverConfiguration/driverConfigurationSchema");
const router = express_1.default.Router();
router.get("/", driverConfigurationController_1.DriverConfigurationController.get);
router.post("/", validate_1.validate.body(driverConfigurationSchema_1.createDriverConfigurationSchema), driverConfigurationController_1.DriverConfigurationController.create);
router.put("/:id", validate_1.validate.body(driverConfigurationSchema_1.updateDriverConfigurationSchema), driverConfigurationController_1.DriverConfigurationController.update);
exports.default = router;

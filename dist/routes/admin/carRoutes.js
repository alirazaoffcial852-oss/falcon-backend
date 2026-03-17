"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const carController_1 = require("../../controllers/car/carController");
const validate_1 = require("../../middleware/validation/validate");
const carSchema_1 = require("../../schemas/car/carSchema");
const router = express_1.default.Router();
router.get("/", carController_1.CarController.list);
router.get("/:id", validate_1.validate.params(carSchema_1.carIdParamSchema), carController_1.CarController.getById);
router.post("/", validate_1.validate.body(carSchema_1.createCarSchema), carController_1.CarController.create);
router.put("/:id", validate_1.validate.combined(carSchema_1.updateCarSchema, carSchema_1.carIdParamSchema), carController_1.CarController.update);
router.delete("/:id", validate_1.validate.params(carSchema_1.carIdParamSchema), carController_1.CarController.delete);
exports.default = router;

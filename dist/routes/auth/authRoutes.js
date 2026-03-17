"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../../controllers/auth/authController");
const authSchema_1 = require("../../schemas/auth/authSchema");
const validate_1 = require("../../middleware/validation/validate");
const router = express_1.default.Router();
router.post("/register", validate_1.validate.body(authSchema_1.registerSchema), authController_1.AuthController.register);
router.post("/login", validate_1.validate.body(authSchema_1.loginSchema), authController_1.AuthController.login);
exports.default = router;

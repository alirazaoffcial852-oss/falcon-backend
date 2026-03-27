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
router.post("/forgot-password/request-otp", validate_1.validate.body(authSchema_1.forgotPasswordRequestSchema), authController_1.AuthController.forgotPasswordRequestOtp);
router.post("/forgot-password/verify-otp", validate_1.validate.body(authSchema_1.forgotPasswordVerifyOtpSchema), authController_1.AuthController.forgotPasswordVerifyOtp);
router.post("/forgot-password/reset-password", validate_1.validate.body(authSchema_1.forgotPasswordResetSchema), authController_1.AuthController.forgotPasswordReset);
exports.default = router;

import express from "express";
import { AuthController } from "../../controllers/auth/authController";
import {
	loginSchema,
	registerSchema,
	forgotPasswordRequestSchema,
	forgotPasswordVerifyOtpSchema,
	forgotPasswordResetSchema,
} from "../../schemas/auth/authSchema";
import { validate } from "../../middleware/validation/validate";

const router = express.Router();

router.post(
	"/register",
	validate.body(registerSchema),
	AuthController.register,
);
router.post("/login", validate.body(loginSchema), AuthController.login);
router.post(
	"/forgot-password/request-otp",
	validate.body(forgotPasswordRequestSchema),
	AuthController.forgotPasswordRequestOtp,
);
router.post(
	"/forgot-password/verify-otp",
	validate.body(forgotPasswordVerifyOtpSchema),
	AuthController.forgotPasswordVerifyOtp,
);
router.post(
	"/forgot-password/reset-password",
	validate.body(forgotPasswordResetSchema),
	AuthController.forgotPasswordReset,
);

export default router;

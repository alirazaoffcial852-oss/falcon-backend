import express from "express";
import { AuthController } from "../../controllers/auth/authController";
import { loginSchema, registerSchema } from "../../schemas/auth/authSchema";
import { validate } from "../../middleware/validation/validate";

const router = express.Router();

router.post("/register", validate.body(registerSchema), AuthController.register);
router.post("/login", validate.body(loginSchema), AuthController.login);

export default router;

import express from "express";
import { AuthController } from "../../controllers/auth/authController";
import { loginSchema } from "../../schemas/auth/authSchema";
import { validate } from "../../middleware/validation/validate";

const router = express.Router();

router.post("/login", validate.body(loginSchema), AuthController.login);

export default router;

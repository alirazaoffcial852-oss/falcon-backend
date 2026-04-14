import express from "express";
import { PayrollController } from "../../controllers/payroll/payrollController";
import { validate } from "../../middleware/validation/validate";
import {
	payrollPreviewQuerySchema,
	payrollSettleBodySchema,
} from "../../schemas/payroll/payrollSchema";

const router = express.Router();

router.get("/preview", validate.query(payrollPreviewQuerySchema), PayrollController.preview);
router.post("/settle", validate.body(payrollSettleBodySchema), PayrollController.settle);

export default router;

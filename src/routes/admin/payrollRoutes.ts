import express from "express";
import { PayrollController } from "../../controllers/payroll/payrollController";
import { validate } from "../../middleware/validation/validate";
import {
	payrollHistoryQuerySchema,
	payrollPreviewQuerySchema,
	payrollSettleBodySchema,
} from "../../schemas/payroll/payrollSchema";

const router = express.Router();

router.get("/preview", validate.query(payrollPreviewQuerySchema), PayrollController.preview);
router.get("/history", validate.query(payrollHistoryQuerySchema), PayrollController.history);
router.post("/settle", validate.body(payrollSettleBodySchema), PayrollController.settle);

export default router;

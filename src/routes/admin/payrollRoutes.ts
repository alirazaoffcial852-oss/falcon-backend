import express from "express";
import { PayrollController } from "../../controllers/payroll/payrollController";
import { validate } from "../../middleware/validation/validate";
import {
	payrollHistoryQuerySchema,
	payrollPreviewQuerySchema,
	payrollSettleBodySchema,
	payrollUnsettleBodySchema,
} from "../../schemas/payroll/payrollSchema";

const router = express.Router();

router.get("/preview", validate.query(payrollPreviewQuerySchema), PayrollController.preview);
router.get("/history", validate.query(payrollHistoryQuerySchema), PayrollController.history);
router.post("/settle", validate.body(payrollSettleBodySchema), PayrollController.settle);
router.post(
	"/unsettle",
	validate.body(payrollUnsettleBodySchema),
	PayrollController.unsettle,
);

export default router;

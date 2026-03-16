import express from "express";
import { CompanyController } from "../../controllers/company/companyController";
import { validate } from "../../middleware/validation/validate";
import {
	createCompanySchema,
	updateCompanySchema,
	companyIdParamSchema,
} from "../../schemas/company/companySchema";

const router = express.Router();

router.get("/", CompanyController.list);
router.get(
	"/:id",
	validate.params(companyIdParamSchema),
	CompanyController.getById,
);
router.post("/", validate.body(createCompanySchema), CompanyController.create);
router.patch(
	"/:id",
	validate.combined(updateCompanySchema, companyIdParamSchema),
	CompanyController.update,
);
router.delete(
	"/:id",
	validate.params(companyIdParamSchema),
	CompanyController.delete,
);

export default router;

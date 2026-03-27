"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const companyController_1 = require("../../controllers/company/companyController");
const validate_1 = require("../../middleware/validation/validate");
const companySchema_1 = require("../../schemas/company/companySchema");
const router = express_1.default.Router();
router.get("/", companyController_1.CompanyController.list);
router.get("/:id", validate_1.validate.params(companySchema_1.companyIdParamSchema), companyController_1.CompanyController.getById);
router.post("/", validate_1.validate.body(companySchema_1.createCompanySchema), companyController_1.CompanyController.create);
router.patch("/:id", validate_1.validate.combined(companySchema_1.updateCompanySchema, companySchema_1.companyIdParamSchema), companyController_1.CompanyController.update);
router.delete("/:id", validate_1.validate.params(companySchema_1.companyIdParamSchema), companyController_1.CompanyController.delete);
exports.default = router;

import { Router } from "express";
import { adminController } from "../../controllers/adminController";

const router = Router();

router.get("/", adminController.getAllAdmins);

router.get("/permissions/me", adminController.getMyPermissions);

router.post("/permissions/check", adminController.checkPermission);

router.post("/", adminController.createAdmin);

router.get("/:id", adminController.getAdminById);

router.put("/:id", adminController.updateAdmin);

router.delete("/:id", adminController.deleteAdmin);

export default router;

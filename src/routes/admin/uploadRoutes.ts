import express from "express";
import { UploadController } from "../../controllers/upload/uploadController";

const router = express.Router();

router.post("/image", UploadController.image);

export default router;


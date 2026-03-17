"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const uploadController_1 = require("../../controllers/upload/uploadController");
const router = express_1.default.Router();
router.post("/image", uploadController_1.UploadController.image);
exports.default = router;

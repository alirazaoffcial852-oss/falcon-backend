"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compressImage = compressImage;
const sharp_1 = __importDefault(require("sharp"));
async function compressImage(buffer, options) {
    let sharpInstance = (0, sharp_1.default)(buffer);
    // Resize if dimensions provided
    if (options.width || options.height) {
        sharpInstance = sharpInstance.resize(options.width, options.height, {
            fit: "inside",
            withoutEnlargement: true,
        });
    }
    // Apply format and quality
    switch (options.format) {
        case "jpeg":
            sharpInstance = sharpInstance.jpeg({
                quality: options.quality || 60,
                progressive: true,
            });
            break;
        case "png":
            sharpInstance = sharpInstance.png({
                quality: options.quality || 60,
                compressionLevel: 9,
            });
            break;
        case "webp":
            sharpInstance = sharpInstance.webp({
                quality: options.quality || 60,
            });
            break;
        default:
            sharpInstance = sharpInstance.jpeg({ quality: options.quality || 80 });
    }
    return await sharpInstance.toBuffer();
}

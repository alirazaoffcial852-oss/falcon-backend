"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUploadUtil = void 0;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const compressImage_1 = require("./compressImage");
exports.FileUploadUtil = {
    async deleteImage(imagePath) {
        try {
            if (!imagePath)
                return;
            const fullPath = path_1.default.join(__dirname, "../../", imagePath);
            await promises_1.default.unlink(fullPath);
        }
        catch (error) {
            console.error(`Error deleting file: ${error.message}`);
        }
    },
    /**
     * Uploads an image file to a specified directory based on the type.
     *
     * @param file - The file object containing the image to be uploaded
     * @param type - The type of directory to store the image in ('driver_image' or 'company_logos')
     * @returns A Promise that resolves to the relative path of the uploaded file as a string
     * @throws Error if file upload fails
     *
     * @example
     * const file = req.files.image; // UploadedFile from express-fileupload
     * const path = await uploadImage(file, 'driver_image');
     * // Returns: 'uploads/driver_image/image-1234567890-123456789.jpg'
     */
    async uploadImage(file, type) {
        try {
            const uploadDir = path_1.default.join(__dirname, `../../uploads/${type}`);
            await promises_1.default.mkdir(uploadDir, { recursive: true });
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const fileExtension = path_1.default.extname(file.name);
            const fileName = `image-${uniqueSuffix}${fileExtension}`;
            const filePath = path_1.default.join(uploadDir, fileName);
            // Compress the image before saving
            const compressOptions = {
                width: 1200, // Max width
                height: 1200, // Max height
                quality: 60, // Quality setting
                format: "jpeg", // Convert to JPEG for better compression
            };
            const compressedBuffer = await (0, compressImage_1.compressImage)(file.data, compressOptions);
            // Write compressed image to file
            await promises_1.default.writeFile(filePath, compressedBuffer);
            return `uploads/${type}/${fileName}`;
        }
        catch (error) {
            throw new Error(`Error uploading file: ${error.message}`);
        }
    },
};

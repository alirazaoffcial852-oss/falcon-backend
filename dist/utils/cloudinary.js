"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryUtil = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const BASE_FOLDER = "falcon_uploads";
exports.CloudinaryUtil = {
    async uploadImage(file, type) {
        const base64 = file.data.toString("base64");
        const result = await cloudinary_1.v2.uploader.upload(`data:${file.mimetype};base64,${base64}`, {
            folder: BASE_FOLDER,
            resource_type: "image",
            public_id: `${type}-${Date.now()}`,
            tags: [type],
            transformation: [
                {
                    width: 1200,
                    height: 1200,
                    crop: "limit",
                    quality: "auto",
                },
            ],
        });
        return {
            url: result.secure_url,
            public_id: result.public_id,
        };
    },
    async delete(publicId) {
        if (!publicId)
            return;
        await cloudinary_1.v2.uploader.destroy(publicId, { resource_type: "image" });
    },
};

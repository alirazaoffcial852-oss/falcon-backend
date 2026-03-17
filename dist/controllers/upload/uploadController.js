"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadController = void 0;
const catchAsync_1 = require("../../middleware/catchAsync");
const ResponseHandler_1 = require("../../utils/responses/ResponseHandler");
const cloudinary_1 = require("../../utils/cloudinary");
exports.UploadController = {
    image: (0, catchAsync_1.catchAsync)(async (req, res) => {
        const file = req.files?.file;
        if (!file || Array.isArray(file)) {
            throw ResponseHandler_1.ResponseHandler.badRequest("Image file is required with field name 'file'");
        }
        const type = (req.body.type || req.query.type);
        if (!type) {
            throw ResponseHandler_1.ResponseHandler.badRequest("type is required. Valid: company_logos, driver_image, driver_cnic_front, driver_cnic_back, front_car_image, back_car_image, front_car_card, back_car_card, driver_license_front, driver_license_back");
        }
        const result = await cloudinary_1.CloudinaryUtil.uploadImage(file, type);
        return ResponseHandler_1.ResponseHandler.created(res, {
            url: result.url,
            public_id: result.public_id,
            type,
        }, "Image uploaded successfully");
    }),
};

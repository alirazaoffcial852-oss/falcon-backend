import type { Request, Response } from "express";
import { catchAsync } from "../../middleware/catchAsync";
import { ResponseHandler } from "../../utils/responses/ResponseHandler";
import { CloudinaryUtil, type UploadType } from "../../utils/cloudinary";

export const UploadController = {
	image: catchAsync(async (req: Request, res: Response) => {
		const file = req.files?.file;

		if (!file || Array.isArray(file)) {
			throw ResponseHandler.badRequest(
				"Image file is required with field name 'file'",
			);
		}

		const type = (req.body.type || req.query.type) as UploadType | undefined;

		if (!type) {
			throw ResponseHandler.badRequest(
				"type is required. Valid: company_logos, driver_image, driver_cnic_front, driver_cnic_back, front_car_image, back_car_image, front_car_card, back_car_card, driver_license_front, driver_license_back",
			);
		}

		const result = await CloudinaryUtil.uploadImage(file, type);

		return ResponseHandler.created(
			res,
			{
				url: result.url,
				public_id: result.public_id,
				type,
			},
			"Image uploaded successfully",
		);
	}),
};


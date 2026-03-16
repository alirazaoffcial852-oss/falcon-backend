import { v2 as cloudinary } from "cloudinary";
import type { UploadedFile } from "express-fileupload";

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const BASE_FOLDER = "falcon_uploads";

export interface CloudinaryUploadResult {
	url: string;
	public_id: string;
}

export type UploadType =
	| "company_logos"
	| "driver_image"
	| "driver_cnic_front"
	| "driver_cnic_back"
	| "front_car_image"
	| "back_car_image"
	| "front_car_card"
	| "back_car_card"
	| "driver_license_front"
	| "driver_license_back";

export const CloudinaryUtil = {
	async uploadImage(
		file: UploadedFile,
		type: UploadType,
	): Promise<CloudinaryUploadResult> {
		const base64 = file.data.toString("base64");

		const result = await cloudinary.uploader.upload(
			`data:${file.mimetype};base64,${base64}`,
			{
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
			},
		);

		return {
			url: result.secure_url,
			public_id: result.public_id,
		};
	},

	async delete(publicId: string) {
		if (!publicId) return;
		await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
	},
};


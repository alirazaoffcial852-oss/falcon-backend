import { UploadedFile } from "express-fileupload";
import path from "path";
import fs from "fs/promises";
import { compressImage, CompressOptions } from "./compressImage";

export const FileUploadUtil = {
	async deleteImage(imagePath: string): Promise<void> {
		try {
			if (!imagePath) return;

			const fullPath = path.join(__dirname, "../../", imagePath);
			await fs.unlink(fullPath);
		} catch (error: any) {
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
	async uploadImage(
		file: UploadedFile,
		type:
			| "company_logos"
			| "driver_image"
			| "driver_cnic_front"
			| "driver_cnic_back"
			| "front_car_image"
			| "back_car_image"
			| "front_car_card"
			| "back_car_card"
			| "driver_license_front"
			| "driver_license_back",
	): Promise<string> {
		try {
			const uploadDir = path.join(__dirname, `../../uploads/${type}`);
			await fs.mkdir(uploadDir, { recursive: true });

			const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
			const fileExtension = path.extname(file.name);
			const fileName = `image-${uniqueSuffix}${fileExtension}`;
			const filePath = path.join(uploadDir, fileName);

			// Compress the image before saving
			const compressOptions: CompressOptions = {
				width: 1200, // Max width
				height: 1200, // Max height
				quality: 60, // Quality setting
				format: "jpeg", // Convert to JPEG for better compression
			};

			const compressedBuffer = await compressImage(file.data, compressOptions);

			// Write compressed image to file
			await fs.writeFile(filePath, compressedBuffer);

			return `uploads/${type}/${fileName}`;
		} catch (error: any) {
			throw new Error(`Error uploading file: ${error.message}`);
		}
	},
};

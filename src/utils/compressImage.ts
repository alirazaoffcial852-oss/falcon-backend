import sharp from "sharp";

export interface CompressOptions {
	width?: number;
	height?: number;
	quality?: number;
	format?: "jpeg" | "png" | "webp";
}

export async function compressImage(
	buffer: Buffer,
	options: CompressOptions,
): Promise<Buffer> {
	let sharpInstance = sharp(buffer);

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

import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { DriverConfiguration } from "../types/admin/driverConfiguration";

export class DriverConfigurationService {
	private db = DatabaseService.getInstance().getPrisma();

	async get() {
		const config = await this.db.driverConfiguration.findFirst({
			orderBy: { id: "desc" },
		});
		if (!config)
			throw ResponseHandler.notFound("Driver configuration not found");
		return config;
	}

	async create(data: DriverConfiguration) {
		const existing = await this.db.driverConfiguration.findFirst();
		if (existing)
			throw ResponseHandler.badRequest(
				"Driver configuration already exists. Use update.",
			);
		return this.db.driverConfiguration.create({
			data: {
				availability_time: data.availability_time.trim(),
				still_waiting_button_appear_in:
					data.still_waiting_button_appear_in.trim(),
				remaining_start_time: data.remaining_start_time.trim(),
				passenger_waiting_time: data.passenger_waiting_time.trim(),
				skip_button_appear_in: data.skip_button_appear_in.trim(),
			},
		});
	}

	async update(id: number, data: Partial<DriverConfiguration>) {
		await this.db.driverConfiguration.findUniqueOrThrow({ where: { id } });
		return this.db.driverConfiguration.update({
			where: { id },
			data: {
				...(data.availability_time !== undefined && {
					availability_time: data.availability_time.trim(),
				}),
				...(data.still_waiting_button_appear_in !== undefined && {
					still_waiting_button_appear_in:
						data.still_waiting_button_appear_in.trim(),
				}),
				...(data.remaining_start_time !== undefined && {
					remaining_start_time: data.remaining_start_time.trim(),
				}),
				...(data.passenger_waiting_time !== undefined && {
					passenger_waiting_time: data.passenger_waiting_time.trim(),
				}),
				...(data.skip_button_appear_in !== undefined && {
					skip_button_appear_in: data.skip_button_appear_in.trim(),
				}),
			},
		});
	}
}

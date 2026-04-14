import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type { FuelPriceInput } from "../types/admin/fuelPrice";

export class FuelPriceService {
	private db = DatabaseService.getInstance().getPrisma();

	async create(data: FuelPriceInput) {
		const effectiveFrom = data.effective_from
			? new Date(data.effective_from)
			: new Date();
		if (Number.isNaN(effectiveFrom.getTime())) {
			throw ResponseHandler.badRequest("Invalid effective_from datetime");
		}
		return this.db.fuelPrice.create({
			data: {
				price_per_liter: Number(data.price_per_liter),
				effective_from: effectiveFrom,
			},
		});
	}

	async getCurrent() {
		const now = new Date();
		const current = await this.db.fuelPrice.findFirst({
			where: { effective_from: { lte: now } },
			orderBy: [{ effective_from: "desc" }, { id: "desc" }],
		});
		if (!current) {
			throw ResponseHandler.notFound("Fuel price is not configured");
		}
		return current;
	}

	async list() {
		return this.db.fuelPrice.findMany({
			orderBy: [{ effective_from: "desc" }, { id: "desc" }],
		});
	}
}

export const fuelPriceService = new FuelPriceService();

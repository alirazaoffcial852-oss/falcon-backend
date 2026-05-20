import { DatabaseService } from "../config/database";
import { ResponseHandler } from "../utils/responses/ResponseHandler";
import type {
	FuelPriceInput,
	FuelPriceUpdateInput,
} from "../types/admin/fuelPrice";

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

	async update(id: number, data: FuelPriceUpdateInput) {
		const row = await this.db.fuelPrice.findUnique({ where: { id } });
		if (!row) {
			throw ResponseHandler.notFound("Fuel price record not found");
		}

		const patch: { price_per_liter?: number; effective_from?: Date } = {};
		if (data.price_per_liter != null) {
			patch.price_per_liter = Number(data.price_per_liter);
		}
		if (data.effective_from != null) {
			const effectiveFrom = new Date(data.effective_from);
			if (Number.isNaN(effectiveFrom.getTime())) {
				throw ResponseHandler.badRequest("Invalid effective_from datetime");
			}
			patch.effective_from = effectiveFrom;
		}

		return this.db.fuelPrice.update({
			where: { id },
			data: patch,
		});
	}

	async delete(id: number) {
		const row = await this.db.fuelPrice.findUnique({ where: { id } });
		if (!row) {
			throw ResponseHandler.notFound("Fuel price record not found");
		}
		await this.db.fuelPrice.delete({ where: { id } });
		return row;
	}
}

export const fuelPriceService = new FuelPriceService();

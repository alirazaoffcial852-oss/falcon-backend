export interface FuelPriceInput {
	price_per_liter: number;
	effective_from?: string;
}

export interface FuelPriceUpdateInput {
	price_per_liter?: number;
	effective_from?: string;
}

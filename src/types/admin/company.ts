export interface CompanyListQuery {
	page: number;
	limit: number;
	search?: string;
}

export interface Company {
	name: string;
	email?: string;
	phone_no?: string | null;
	address: string;
	lat?: number;
	long?: number;
	weekly_off_days?: (
		| "SUNDAY"
		| "MONDAY"
		| "TUESDAY"
		| "WEDNESDAY"
		| "THURSDAY"
		| "FRIDAY"
		| "SATURDAY"
	)[];
}

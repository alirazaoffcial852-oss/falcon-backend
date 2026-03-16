export interface CompanyListQuery {
	page: number;
	limit: number;
	search?: string;
}

export interface Company {
	name: string;
	email?: string;
	phoneNo: string;
	address: string;
}

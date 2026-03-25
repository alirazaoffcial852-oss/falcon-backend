export interface PassengerListQuery {
	page: number;
	limit: number;
	search?: string;
	companyId?: number;
}

export interface Passenger {
	email?: string;
	role_id?: number;
	name: string;
	phoneNo: string;
	officeAddress: string;
	companyId: number;
	pickUpTime?: string;
	dropOffTime?: string;
}

export interface PassengerListQuery {
	page: number;
	limit: number;
	search?: string;
	companyId?: number;
}

export interface Passenger {
	email?: string;
	name?: string;
	phoneNo?: string;
	homeAddress?: string;
	homeLat?: number;
	homeLong?: number;
	officeAddress?: string;
	officeLat?: number;
	officeLong?: number;
	companyId?: number;
	pickUpTime?: string;
	dropOffTime?: string;
	officePickUpTime?: string;
}

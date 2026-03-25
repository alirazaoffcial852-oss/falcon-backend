export type PassengerAckInput = "COMING" | "NOT_COMING";

export interface PassengerAckBody {
	ack: PassengerAckInput;
}

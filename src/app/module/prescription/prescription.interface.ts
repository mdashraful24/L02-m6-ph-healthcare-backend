export interface IMedicine {
	name: string;
	dosage: string;
	duration: string;
	instructions?: string;
}

export interface ICreatedPrescriptionPayload {
	appointmentId: string;
	findings: string;
	medicines: IMedicine[];
}

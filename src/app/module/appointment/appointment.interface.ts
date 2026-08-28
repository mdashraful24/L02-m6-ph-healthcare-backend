export interface IBookAppointmentPayload {
    scheduleId: string;
}

export interface IPayAppointmentPayload {
    appointmentId: string;
}

export interface ICancelAppointmentPayload {
    appointmentId: string;
}

export interface IUpdateAppointmentPayload {
    status: "ONGOING" | "COMPLETED";
}

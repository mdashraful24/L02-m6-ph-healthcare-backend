import z from "zod";

export const BookAppointmentZodValidationSchema = z.object({
	scheduleId: z.string().min(1, "Schedule Id Is Required"),
});

export const PayAppointmentZodValidationSchema = z.object({
	appointmentId: z.string().min(1, "Appointment Id Is Required"),
});

export const CancelAppointmentZodValidationSchema = z.object({
	appointmentId: z.string().min(1, "Appointment Id Is Required"),
});

export const UpdateAppointmentStatusZodValidationSchema = z.object({
	status: z.enum(
		["ONGOING", "COMPLETED"],
		"Status Must Be Either ONGOING Or COMPLETED",
	),
});

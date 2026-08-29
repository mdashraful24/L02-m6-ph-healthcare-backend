import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AppointmentController } from "./appointment.controller";
import {
	BookAppointmentZodValidationSchema,
	CancelAppointmentZodValidationSchema,
	PayAppointmentZodValidationSchema,
	UpdateAppointmentStatusZodValidationSchema,
} from "./appointment.validation";

const router = Router();

router.post(
	"/book-appointment",
	auth(Role.PATIENT),
	validateRequest(BookAppointmentZodValidationSchema),
	AppointmentController.bookAppointment,
);

router.post(
	"/pay-appointment",
	auth(Role.PATIENT),
	validateRequest(PayAppointmentZodValidationSchema),
	AppointmentController.payAppointment,
);

router.get(
	"/book-appointment/payment/callback",
	AppointmentController.bookAppointmentCallback,
);

router.post(
	"/cancel-appointment",
	auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN),
	validateRequest(CancelAppointmentZodValidationSchema),
	AppointmentController.cancelAppointment,
);

router.patch(
	"/update-appointment-status/:appointmentId",
	auth(Role.DOCTOR),
	validateRequest(UpdateAppointmentStatusZodValidationSchema),
	AppointmentController.updateAppointmentStatus,
);

router.get(
	"/my-appointments",
	auth(Role.PATIENT),
	AppointmentController.getMyAppointments,
);

router.get(
	"/doctor-appointments",
	auth(Role.DOCTOR),
	AppointmentController.getMyDoctorAppointments,
);

router.get(
	"/all-appointments",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentController.getAllAppointments,
);

router.get(
	"/:appointmentId",
	auth(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
	AppointmentController.getSingleAppointmentDetails,
);

export const AppointmentRoutes = router;

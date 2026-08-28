import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ScheduleController } from "./schedule.controller";
import { ScheduleValidation } from "./schedule.validation";

const router = Router();

router.post(
	"/create-schedule",
	auth(Role.DOCTOR),
	validateRequest(ScheduleValidation.createScheduleZodSchema),
	ScheduleController.createSchedule,
);

router.get(
	"/my-schedules",
	auth(Role.DOCTOR),
	ScheduleController.getMySchedules,
);

router.get(
	"/all-schedules",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ScheduleController.getAllSchedules,
);

router.get("/todays-schedules", ScheduleController.getTodaysSchedules);

router.get(
	"/:scheduleId",
	auth(Role.DOCTOR, Role.ADMIN, Role.SUPER_ADMIN),
	ScheduleController.getScheduleById,
);

router.patch(
	"/update-schedule/:scheduleId",
	auth(Role.DOCTOR),
	validateRequest(ScheduleValidation.updateScheduleZodSchema),
	ScheduleController.updateSchedule,
);

router.patch(
	"/publish-schedule/:scheduleId",
	auth(Role.DOCTOR),
	ScheduleController.publishSchedule,
);

router.delete(
	"/delete-schedule/:scheduleId",
	auth(Role.DOCTOR),
	ScheduleController.deleteSchedule,
);

export const ScheduleRoutes = router;

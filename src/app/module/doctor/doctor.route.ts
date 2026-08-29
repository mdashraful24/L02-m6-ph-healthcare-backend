import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DoctorController } from "./doctor.controller";
import { doctorValidationSchemas } from "./doctor.validation";

const router = Router();

router.post(
	"/apply-as-doctor",
	upload.fields([
		{ name: "resume", maxCount: 1 },
		{ name: "additionalDocuments", maxCount: 5 },
	]),
	DoctorController.applyAsDoctor,
);

router.post(
	"/apply-as-doctor/verify-email",
	validateRequest(doctorValidationSchemas.VerifyDoctorEmailSchema),
	DoctorController.verifyDoctorEmail,
);

router.post(
	"/approve-doctor",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	validateRequest(doctorValidationSchemas.ApproveDoctorSchema),
	DoctorController.approveDoctor,
);

router.get(
	"/all-doctors",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	DoctorController.getAllDoctors,
);

router.get("/all-doctors-public", DoctorController.getAllDoctorsListPublic);

router.get(
	"/available-doctors-today",
	DoctorController.getAvailableDoctorByTodaysSchedule,
);

router.get("/public/:doctorId", DoctorController.getSingleDoctorPublicProfile);

router.patch(
	"/update-my-profile",
	auth(Role.DOCTOR),
	validateRequest(doctorValidationSchemas.UpdateDoctorProfileSchema),
	DoctorController.updateDoctorProfile,
);

export const DoctorRoutes = router;

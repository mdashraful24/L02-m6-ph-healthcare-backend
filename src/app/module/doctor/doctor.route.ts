import { Router } from "express";
import { upload } from "../../lib/multer";
import { validateRequest } from "../../middleware/validateRequest";
import { DoctorController } from "./doctor.controller";
import { VerifyDoctorEmailSchema } from "./doctor.validation";

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
	validateRequest(VerifyDoctorEmailSchema),
	DoctorController.verifyDoctorEmail
);

export const DoctorRoutes = router;

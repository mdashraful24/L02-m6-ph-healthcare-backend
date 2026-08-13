import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { userAuthValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
	"/register",
	validateRequest(userAuthValidation.PatientRegistrationZodSchema),
	AuthController.registerPatient,
);
router.post(
	"/verify-email",
	validateRequest(userAuthValidation.PatientEmailVerificationZodSchema),
	AuthController.verifyPatientEmail,
);
router.post(
	"/login",
	validateRequest(userAuthValidation.UserLoginZodSchema),
	AuthController.loginUser,
);
router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);
router.post(
	"/forgot-password",
	validateRequest(userAuthValidation.ForgotPassword),
	AuthController.forgotPassword,
);
router.post(
	"/reset-password",
	validateRequest(userAuthValidation.ResetPassword),
	AuthController.resetPassword,
);

export const AuthRoutes = router;

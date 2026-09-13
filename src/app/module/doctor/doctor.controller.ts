import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { ApplyAsDoctorSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
	const files = req.files as { [fieldname: string]: Express.Multer.File[] };
	const resume = files?.["resume"] ? files["resume"][0] : null;
	const additionalDocuments = files?.["additionalDocuments"] || [];

	// Validate the request body using Zod schema
	const zodValidationResult = ApplyAsDoctorSchema.safeParse(
		JSON.parse(req.body.data),
	);

	if (!zodValidationResult.success) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			zodValidationResult.error.issues[0].message,
		);
	}

	const payload = zodValidationResult.data;

	const result = await DoctorServices.applyAsDoctor(
		payload,
		resume,
		additionalDocuments,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Apply as doctor successfully!",
		data: result,
	});
});

const resendDoctorOtp = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	await DoctorServices.resendDoctorOtp(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "A new verification OTP has been sent to your email.",
		data: null,
	});
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await DoctorServices.verifyDoctorEmail(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor email verified successfully!",
		data: result,
	});
});

const approveDoctor = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await DoctorServices.approveDoctor(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor approved successfully!",
		data: result,
	});
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;

	const result = await DoctorServices.getAllDoctors(query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All doctors retrieved successfully!",
		data: result.data,
		meta: result.meta,
	});
});

const getAvailableDoctorByTodaysSchedule = catchAsync(
	async (req: Request, res: Response) => {
		const query = req.query;

		const result =
			await DoctorServices.getAvailableDoctorByTodaysSchedule(query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Available doctors for today retrieved successfully!",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getAllDoctorsListPublic = catchAsync(
	async (req: Request, res: Response) => {
		const query = req.query;

		const result = await DoctorServices.getAllDoctorsListPublic(query);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "All verified doctors retrieved successfully!",
			data: result.data,
			meta: result.meta,
		});
	},
);

const getSingleDoctorPublicProfile = catchAsync(
	async (req: Request, res: Response) => {
		const doctorId = req.params.doctorId as string;

		const result = await DoctorServices.getSingleDoctorPublicProfile(doctorId);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Doctor public profile retrieved successfully!",
			data: result,
		});
	},
);

const updateDoctorProfile = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await DoctorServices.updateDoctorProfile(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Doctor profile updated successfully!",
		data: result,
	});
});

export const DoctorController = {
	applyAsDoctor,
	resendDoctorOtp,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
	getAvailableDoctorByTodaysSchedule,
	getAllDoctorsListPublic,
	getSingleDoctorPublicProfile,
	updateDoctorProfile,
};

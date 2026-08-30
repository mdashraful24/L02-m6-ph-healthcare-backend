import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PrescriptionService } from "./prescription.service";

const createPrescription = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await PrescriptionService.createPrescription(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Prescription created successfully",
		data: result,
	});
});

const getSinglePrescription = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId;
		const user = req.user!;

		const result = await PrescriptionService.getSinglePrescription(
			appointmentId as string,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Prescription retrieved successfully",
			data: result,
		});
	},
);

export const PrescriptionController = {
	createPrescription,
	getSinglePrescription,
};

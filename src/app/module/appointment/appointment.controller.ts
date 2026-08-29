import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AppointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.bookAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment payment initiated successfully",
		data: result,
	});
});

const payAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.payAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment payment initiated successfully",
		data: result,
	});
});

const bookAppointmentCallback = catchAsync(
	async (req: Request, res: Response) => {
		const { redirectUrl } = await AppointmentServices.bookAppointmentCallback(
			req.query,
		);

		res.redirect(redirectUrl);

		// sendResponse(res, {
		//     statusCode: httpStatus.OK,
		//     success: true,
		//     message: "Book appointment callback successfully",
		//     data: result,
		// });
	},
);

const cancelAppointment = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await AppointmentServices.cancelAppointment(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Appointment cancelled and refunded successfully",
		data: result,
	});
});

const updateAppointmentStatus = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId;
		const payload = req.body;
		const user = req.user!;

		const result = await AppointmentServices.updateAppointmentStatus(
			appointmentId as string,
			payload,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Appointment updated successfully",
			data: result,
		});
	},
);

const getMyAppointments = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const query = req.query;

	const result = await AppointmentServices.getMyAppointments(query, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My appointments retrieved successfully",
		data: result,
	});
});

const getMyDoctorAppointments = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;
		const query = req.query;

		const result = await AppointmentServices.getMyDoctorAppointments(
			query,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "My doctor appointments retrieved successfully",
			data: result,
		});
	},
);

const getAllAppointments = catchAsync(async (req: Request, res: Response) => {
	const query = req.query;

	const result = await AppointmentServices.getAllAppointments(query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All appointments retrieved successfully",
		data: result,
	});
});

const getSingleAppointmentDetails = catchAsync(
	async (req: Request, res: Response) => {
		const appointmentId = req.params.appointmentId;
		const user = req.user!;

		const result = await AppointmentServices.getSingleAppointmentDetails(
			appointmentId as string,
			user,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Single appointment details retrieved successfully",
			data: result,
		});
	},
);

export const AppointmentController = {
	bookAppointment,
	payAppointment,
	bookAppointmentCallback,
	cancelAppointment,
	updateAppointmentStatus,
	getMyAppointments,
	getMyDoctorAppointments,
	getAllAppointments,
	getSingleAppointmentDetails,
};

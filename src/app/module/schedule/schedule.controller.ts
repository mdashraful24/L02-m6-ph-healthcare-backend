import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleService } from "./schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await ScheduleService.createSchedule(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Schedule created successfully",
		data: result,
	});
});

const getMySchedules = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await ScheduleService.getMySchedules(payload, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedules retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getAllSchedules = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await ScheduleService.getAllSchedules(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedules retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getTodaysSchedules = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;

	const result = await ScheduleService.getTodaysSchedules(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Todays schedules retrieved successfully",
		data: result.data,
		meta: result.meta,
	});
});

const getScheduleById = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;

	const result = await ScheduleService.getScheduleById(scheduleId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedule retrieved successfully",
		data: result,
	});
});

const updateSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;
	const payload = req.body;
	const user = req.user!;

	const result = await ScheduleService.updateSchedule(
		scheduleId,
		payload,
		user,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedule updated successfully",
		data: result,
	});
});

const publishSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;
	const user = req.user!;

	const result = await ScheduleService.publishSchedule(scheduleId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedule published successfully",
		data: result,
	});
});

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
	const scheduleId = req.params.scheduleId as string;
	const user = req.user!;

	const result = await ScheduleService.deleteSchedule(scheduleId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Schedule deleted successfully",
		data: result,
	});
});

export const ScheduleController = {
	createSchedule,
	getMySchedules,
	getAllSchedules,
	getTodaysSchedules,
	getScheduleById,
	updateSchedule,
	publishSchedule,
	deleteSchedule,
};

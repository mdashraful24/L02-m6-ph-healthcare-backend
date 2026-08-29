import { Request, Response } from "express";
import httpStatus from 'http-status';
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsServices } from "./analytics.service";

const getPatientAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getPatientAnalytics(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Patient analytics retrieved successfully",
        data: result,
    });
});

const getDoctorAnalytics = catchAsync(async (req: Request, res: Response) => {
    const user = req.user!;

    const result = await AnalyticsServices.getDoctorAnalytics(user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Doctor analytics retrieved successfully",
        data: result,
    });
});

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
    const result = await AnalyticsServices.getAdminAnalytics();

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin analytics retrieved successfully",
        data: result,
    });
});

export const AnalyticsController = {
    getAdminAnalytics,
    getDoctorAnalytics,
    getPatientAnalytics
};
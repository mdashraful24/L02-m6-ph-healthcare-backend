import { Request, Response } from "express";
import httpStatus from 'http-status';
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
    const payload = req.query;
    const user = req.user!;

    const payments = await PaymentService.getMyPayments(payload, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payments fetched successfully",
        data: payments.data,
        meta: payments.meta,
    });
});

const getAllPayments = catchAsync(async (req: Request, res: Response) => {
    const payload = req.query;

    const payments = await PaymentService.getAllPayments(payload);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payments fetched successfully",
        data: payments.data,
        meta: payments.meta,
    });
});

const getSinglePaymentDetails = catchAsync(async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const user = req.user!;

    const payment = await PaymentService.getSinglePaymentDetails(paymentId as string, user);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Payment details fetched successfully",
        data: payment,
    });
});

export const PaymentController = {
    getMyPayments,
    getAllPayments,
    getSinglePaymentDetails,
};
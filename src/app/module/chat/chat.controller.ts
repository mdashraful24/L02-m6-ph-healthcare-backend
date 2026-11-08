import httpStatus from 'http-status';
import { ChatServices } from './chat.service';
import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from '../../utils/sendResponse';

const sendMessage = catchAsync(async(req: Request, res: Response) => {
    const result = await ChatServices.sendMessage(req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Chat Reply generated successfully",
        data: result
    });
});

export const ChatController = {
    sendMessage
};
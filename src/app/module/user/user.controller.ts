import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const uploadProfilePicture = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new Error("No file uploaded");
	}

	const userId = req.user?.userId;

	const result = await UserServices.uploadProfilePicture(
		req.file?.buffer as Buffer,
		userId!,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile picture uploaded successfully",
		data: result,
	});
});

export const UserController = {
	uploadProfilePicture,
};

import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DoctorServices } from "./doctor.service";
import { ApplyAsDoctorSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const resume = files?.["resume"] ? files["resume"][0] : null;
    const additionalDocuments = files?.["additionalDocuments"] || [];

    // Validate the request body using Zod schema
    const zodValidationResult = ApplyAsDoctorSchema.safeParse(JSON.parse(req.body.data));

    if (!zodValidationResult.success) {
        throw new Error(zodValidationResult.error.issues[0].message);
    }

    const payload = zodValidationResult.data;

    const result = await DoctorServices.applyAsDoctor(payload, resume, additionalDocuments);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Apply as doctor successfully!",
        data: result,
    });
});

export const DoctorController = {
    applyAsDoctor,
};

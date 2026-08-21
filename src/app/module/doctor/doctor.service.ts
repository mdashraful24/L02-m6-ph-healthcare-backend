import bcrypt from "bcryptjs";
import { UploadApiResponse } from "cloudinary";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma";
import { IApplyAsDoctor } from "./doctor.interface";

const applyAsDoctor = async (
    payload: IApplyAsDoctor,
    resume: Express.Multer.File | null,
    additionalDocuments: Express.Multer.File[],
) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            email: payload.user.email,
        }
    });

    if (isUserExist) {
        throw new Error("User with this email already exists.");
    }

    const resumeUploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                { resource_type: "auto" }, async (error, result) => {
                    if (error) {
                        return reject(error);
                    }

                    if (!result) {
                        return reject(new Error("No result returned from Cloudinary"));
                    }

                    resolve(result);
                }
            ).end(resume?.buffer);
    });

    const additionalDocumentsUploadResults = await Promise.all(
        additionalDocuments.map((document) => {
            return new Promise<UploadApiResponse>((resolve, reject) => {
                cloudinary.uploader
                    .upload_stream(
                        { resource_type: "auto" }, async (error, result) => {
                            if (error) {
                                return reject(error);
                            }

                            if (!result) {
                                return reject(new Error("No result returned from Cloudinary"));
                            }

                            resolve(result);
                        }
                    ).end(document.buffer);
            });
        })
    );

    const randomDoctorPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomDoctorPassword, Number(config.bcrypt_salt_rounds));

    const doctorApplication = await prisma.user.create({
        data: {
            ...payload.user,
            password: hashedPassword,
            role: Role.DOCTOR,
            needPasswordChange: true,
            doctor: {
                create: {
                    name: payload.user.name,
                    email: payload.user.email,
                    ...payload.doctor,
                    resume: resumeUploadResult.secure_url,
                    resumePublicId: resumeUploadResult.public_id,
                    additionalDocuments:
                        additionalDocumentsUploadResults.map((document) => ({
                            url: document.secure_url,
                            publicId: document.public_id,
                        })),
                },
            },
        },
        include:{
            doctor: true,
        }
    });

    return doctorApplication;
};

export const DoctorServices = {
    applyAsDoctor,
};

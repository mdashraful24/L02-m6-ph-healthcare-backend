import bcrypt from "bcryptjs";
import crypto from "crypto";
import ejs from "ejs";
import path from "path";
import { UploadApiResponse } from "cloudinary";
import { Role } from "../../../generated/prisma/enums";
import config from "../../config";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { IApplyAsDoctor } from "./doctor.interface";
import { IVerifyDoctorEmailPayload } from "./doctor.validation";

const applyAsDoctor = async (
	payload: IApplyAsDoctor,
	resume: Express.Multer.File | null,
	additionalDocuments: Express.Multer.File[],
) => {
	const isUserExist = await prisma.user.findUnique({
		where: {
			email: payload.user.email,
		},
	});

	if (isUserExist) {
		throw new Error("User with this email already exists.");
	}

	const resumeUploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream({ resource_type: "auto" }, async (error, result) => {
					if (error) {
						return reject(error);
					}

					if (!result) {
						return reject(new Error("No result returned from Cloudinary"));
					}

					resolve(result);
				})
				.end(resume?.buffer);
		},
	);

	const additionalDocumentsUploadResults = await Promise.all(
		additionalDocuments.map((document) => {
			return new Promise<UploadApiResponse>((resolve, reject) => {
				cloudinary.uploader
					.upload_stream({ resource_type: "auto" }, async (error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}

						resolve(result);
					})
					.end(document.buffer);
			});
		}),
	);

	const randomDoctorPassword = Math.random().toString(36).slice(-8);
	const hashedPassword = await bcrypt.hash(
		randomDoctorPassword,
		Number(config.bcrypt_salt_rounds),
	);

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
					additionalDocuments: additionalDocumentsUploadResults.map(
						(document) => ({
							url: document.secure_url,
							publicId: document.public_id,
						}),
					),
				},
			},
		},
		include: {
			doctor: true,
		},
	});

	const expirationSeconds = 60 * 60; // 1 hour

	const otpKey = `doctor-application-otp:${payload.user.email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const templatePath = path.join(
		process.cwd(),
		"src/app/templates/registration-otp.ejs",
	);

	const templateData = {
		name: payload.user.name,
		email: payload.user.email,
		otp: otpValue,
		expirationInMinutes: expirationSeconds / 60,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: payload.user.email,
		subject: "Verify Your Email - PH Healthcare Management System",
		html,
	});

	return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const existingUser = await prisma.user.findUnique({
		where: {
			email,
			role: Role.DOCTOR,
		},
	});

	if (!existingUser) {
		throw new Error("Doctor with this email does not exist.");
	}

	if (existingUser.emailVerified) {
		throw new Error("Email is already verified.");
	}

	const otpKey = `doctor-application-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new Error("OTP has expired. Please request a new one.");
	}

	if (redisOtp !== otp) {
		throw new Error("Invalid OTP. Please try again.");
	}

	await redisClient.del(otpKey);

	const verifiedUser = await prisma.user.update({
		where: {
			email,
		},
		data: {
			emailVerified: true,
		},
		omit: {
			password: true,
		},
		include: {
			doctor: true,
		},
	});

	return verifiedUser;
};

export const DoctorServices = {
	applyAsDoctor,
	verifyDoctorEmail,
};

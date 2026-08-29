import bcrypt from "bcryptjs";
import type { UploadApiResponse } from "cloudinary";
import crypto from "crypto";
import { addDays, startOfDay } from "date-fns";
import ejs from "ejs";
import httpStatus from "http-status";
import path from "path";
import {
	DoctorVerificationStatus,
	Role,
	ScheduleStatus,
} from "../../../generated/prisma/enums";
import type { DoctorWhereInput } from "../../../generated/prisma/models";
import config from "../../config";
import type { IQuery } from "../../interfaces";
import { cloudinary } from "../../lib/cloudinary";
import { transporter } from "../../lib/nodemailer";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import type { RequestUser } from "../../middleware/checkAuth";
import { AppError } from "../../utils/AppError";
import type { IApplyAsDoctor, IUpdateDoctorProfile } from "./doctor.interface";
import type {
	IApproveDoctorPayload,
	IVerifyDoctorEmailPayload,
} from "./doctor.validation";

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
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists.",
		);
	}

	const resumeUploadResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream({ resource_type: "auto" }, async (error, result) => {
					if (error) {
						return reject(error);
					}

					if (!result) {
						return reject(
							new AppError(
								httpStatus.BAD_REQUEST,
								"No result returned from Cloudinary",
							),
						);
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
							return reject(
								new AppError(
									httpStatus.BAD_REQUEST,
									"No result returned from Cloudinary",
								),
							);
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
		throw new AppError(
			httpStatus.NOT_FOUND,
			"Doctor with this email does not exist.",
		);
	}

	if (existingUser.emailVerified) {
		throw new AppError(httpStatus.BAD_REQUEST, "Email is already verified.");
	}

	const otpKey = `doctor-application-otp:${email}`;
	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"OTP has expired. Please request a new one.",
		);
	}

	if (redisOtp !== otp) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid OTP. Please try again.",
		);
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

const approveDoctor = async (
	payload: IApproveDoctorPayload,
	reviewer: RequestUser,
) => {
	const { doctorId, verificationStatus, rejectionReason } = payload;

	const existingDoctor = await prisma.doctor.findUnique({
		where: {
			id: doctorId,
		},
		include: {
			user: true,
		},
	});

	if (!existingDoctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor application not found");
	}

	if (existingDoctor.isDeleted) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor application has been deleted.",
		);
	}

	if (!existingDoctor.user.emailVerified) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Doctor's email is not verified. Cannot review the application.",
		);
	}

	if (existingDoctor.verificationStatus !== DoctorVerificationStatus.PENDING) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Doctor application is already ${verificationStatus.toLowerCase()}.`,
		);
	}

	const updatedDoctor = await prisma.doctor.update({
		where: {
			id: doctorId,
		},
		data: {
			verificationStatus,
			rejectionReason:
				verificationStatus === DoctorVerificationStatus.REJECTED
					? rejectionReason
					: null,
			reviewedBy: reviewer.userId,
			reviewedAt: new Date(),
		},
	});

	const isApproved = verificationStatus === DoctorVerificationStatus.VERIFIED;

	const templatePath = path.join(
		process.cwd(),
		`src/app/templates/${
			isApproved
				? "doctor-application-approved.ejs"
				: "doctor-application-rejected.ejs"
		}`,
	);

	const templateData = {
		name: updatedDoctor.name,
		email: updatedDoctor.email,
		reason: updatedDoctor.rejectionReason,
	};

	const html = await ejs.renderFile(templatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: existingDoctor.user.email,
		subject: isApproved
			? "Your Doctor Application Has Been Approved - PH Healthcare Management System"
			: "Your Doctor Application Has Been Rejected - PH Healthcare Management System",
		html,
	});

	return updatedDoctor;
};

const getAllDoctors = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const andConditions: DoctorWhereInput[] = [];

	// Add search term condition if provided
	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					email: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					specialization: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					licenseNumber: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			],
		});
	}

	// Add any other filter conditions based on the query parameters
	if (query.specialization) {
		andConditions.push({
			specialization: { equals: query.specialization, mode: "insensitive" },
		});
	}

	if (query.email) {
		andConditions.push({
			email: { equals: query.email, mode: "insensitive" },
		});
	}

	if (query.licenseNumber) {
		andConditions.push({
			licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
		});
	}

	if (query.verificationStatus) {
		andConditions.push({
			verificationStatus: query.verificationStatus as DoctorVerificationStatus,
		});
	}

	andConditions.push({ isDeleted: false });

	const whereCondition: DoctorWhereInput = {
		AND: andConditions,
	};

	const allDoctors = await prisma.doctor.findMany({
		where: whereCondition,

		// dynamic pagination and sorting
		take: limit,
		skip: skip,

		orderBy: {
			// sortBy : sortOrder
			[sortBy]: sortOrder,
		},

		include: {
			user: {
				omit: {
					password: true,
				},
			},
			// schema: true, // Include the schema relation if needed
			// appointments: true, // Include the appointments relation if needed
			// prescriptions: true, // Include the prescriptions relation if needed
		},
	});

	const totalDoctorCount = await prisma.doctor.count({
		where: {
			AND: andConditions,
		},
	});

	return {
		data: allDoctors,
		meta: {
			page: page,
			limit: limit,
			total: totalDoctorCount,
			totalPages: Math.ceil(totalDoctorCount / limit),
		},
	};
};

const getAvailableDoctorByTodaysSchedule = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "createdAt";
	const sortOrder = query.sortOrder ? query.sortOrder : "desc";

	const now = new Date();
	const startOfToday = startOfDay(now);
	const startOfTomorrow = addDays(startOfToday, 1);

	const andConditions: DoctorWhereInput[] = [
		{
			isDeleted: false,
		},
		{
			verificationStatus: DoctorVerificationStatus.VERIFIED,
		},
		{
			schedules: {
				some: {
					isDeleted: false,
					status: ScheduleStatus.PUBLISHED,
					startDateTime: {
						gte: startOfToday,
						lt: startOfTomorrow,
						gt: now,
					},
					availableSlots: {
						gt: 0,
					},
				},
			},
		},
	];

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					specialization: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			],
		});
	}

	if (query.specialization) {
		andConditions.push({
			specialization: { equals: query.specialization, mode: "insensitive" },
		});
	}

	const whereCondition: DoctorWhereInput = {
		AND: andConditions,
	};

	const doctors = await prisma.doctor.findMany({
		where: whereCondition,

		take: limit,
		skip: skip,

		orderBy: {
			[sortBy]: sortOrder,
		},

		select: {
			id: true,
			name: true,
			specialization: true,
			licenseNumber: true,
			qualifications: true,
			experienceYears: true,
			bio: true,
			consultationFee: true,
			imageUrl: true,
			createdAt: true,

			schedules: {
				where: {
					isDeleted: false,
					status: ScheduleStatus.PUBLISHED,
					startDateTime: {
						gte: startOfToday,
						lt: startOfTomorrow,
						gt: now,
					},
					availableSlots: {
						gt: 0,
					},
				},

				orderBy: {
					[sortBy]: sortOrder,
				},

				select: {
					id: true,
					startDateTime: true,
					endDateTime: true,
					totalSlots: true,
					availableSlots: true,
				},
			},
		},
	});

	const totalDoctors = await prisma.doctor.count({
		where: whereCondition,
	});

	return {
		data: doctors,
		meta: {
			page: page,
			limit: limit,
			total: totalDoctors,
			totalPages: Math.ceil(totalDoctors / limit),
		},
	};
};

const getAllDoctorsListPublic = async (query: IQuery) => {
	const limit = query.limit ? Number(query.limit) : 10;
	const page = query.page ? Number(query.page) : 1;
	const skip = (page - 1) * limit;
	const sortBy = query.sortBy ? query.sortBy : "name";
	const sortOrder = query.sortOrder ? query.sortOrder : "asc";

	const andConditions: DoctorWhereInput[] = [
		{
			isDeleted: false,
		},
		{
			verificationStatus: DoctorVerificationStatus.VERIFIED,
		},
	];

	if (query.searchTerm) {
		andConditions.push({
			OR: [
				{
					name: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					specialization: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
				{
					licenseNumber: {
						contains: query.searchTerm,
						mode: "insensitive",
					},
				},
			],
		});
	}

	if (query.specialization) {
		andConditions.push({
			specialization: { equals: query.specialization, mode: "insensitive" },
		});
	}

	if (query.experienceYears) {
		const experienceYears = Number(query.experienceYears);
		if (!Number.isNaN(experienceYears)) {
			andConditions.push({
				experienceYears: { gte: experienceYears },
			});
		}
	}

	const whereCondition: DoctorWhereInput = {
		AND: andConditions,
	};

	const doctors = await prisma.doctor.findMany({
		where: whereCondition,

		take: limit,
		skip: skip,

		orderBy: {
			[sortBy]: sortOrder,
		},

		select: {
			id: true,
			name: true,
			specialization: true,
			licenseNumber: true,
			qualifications: true,
			experienceYears: true,
			bio: true,
			consultationFee: true,
			imageUrl: true,
			createdAt: true,
		},
	});

	const totalDoctors = await prisma.doctor.count({
		where: whereCondition,
	});

	return {
		data: doctors,
		meta: {
			page: page,
			limit: limit,
			total: totalDoctors,
			totalPages: Math.ceil(totalDoctors / limit),
		},
	};
};

const getSingleDoctorPublicProfile = async (doctorId: string) => {
	// const now = new Date();
	// const startOfToday = startOfDay(now);
	// const startOfTomorrow = addDays(startOfToday, 1);

	const doctor = await prisma.doctor.findUnique({
		where: {
			id: doctorId,
			isDeleted: false,
			verificationStatus: DoctorVerificationStatus.VERIFIED,
		},
		select: {
			id: true,
			name: true,
			specialization: true,
			licenseNumber: true,
			qualifications: true,
			experienceYears: true,
			bio: true,
			consultationFee: true,
			imageUrl: true,
			createdAt: true,

			// schedules: {
			// 	where: {
			// 		isDeleted: false,
			// 		status: ScheduleStatus.PUBLISHED,
			// 		startDateTime: {
			// 			gte: startOfToday,
			// 			lt: startOfTomorrow,
			// 			gt: now,
			// 		},
			// 		availableSlots: {
			// 			gt: 0,
			// 		},
			// 	},
			// 	orderBy: {
			// 		startDateTime: "asc",
			// 	},
			// 	select: {
			// 		id: true,
			// 		startDateTime: true,
			// 		endDateTime: true,
			// 		totalSlots: true,
			// 		availableSlots: true,
			// 	},
			// },
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor not found");
	}

	return doctor;
};

const updateDoctorProfile = async (
	payload: IUpdateDoctorProfile,
	user: RequestUser,
) => {
	const existingDoctor = await prisma.doctor.findUnique({
		where: {
			userId: user.userId,
		},
	});

	if (!existingDoctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor profile not found");
	}

	const updatedDoctor = await prisma.doctor.update({
		where: {
			id: existingDoctor.id,
		},
		data: payload,
	});

	return updatedDoctor;
};

export const DoctorServices = {
	applyAsDoctor,
	verifyDoctorEmail,
	approveDoctor,
	getAllDoctors,
	getAllDoctorsListPublic,
	getAvailableDoctorByTodaysSchedule,
	getSingleDoctorPublicProfile,
	updateDoctorProfile,
};

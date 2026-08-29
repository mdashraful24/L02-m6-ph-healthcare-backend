import { z } from "zod";
import { DoctorVerificationStatus } from "../../../generated/prisma/browser";

export const ApplyAsDoctorSchema = z.object({
	user: z.object({
		name: z
			.string("Name is required")
			.trim()
			.min(2, "Name must be at least 2 characters long")
			.max(100, "Name must not exceed 100 characters"),

		email: z
			.string("Email is required")
			.trim()
			.email("Please provide a valid email address"),

		imageUrl: z
			.string()
			.trim()
			.url("Please provide a valid image URL")
			.or(z.literal(""))
			.optional(),
	}),

	doctor: z.object({
		address: z
			.string()
			.trim()
			.max(255, "Address must not exceed 255 characters")
			.optional(),

		specialization: z
			.string("Specialization is required")
			.trim()
			.min(2, "Specialization is required")
			.max(100, "Specialization must not exceed 100 characters"),

		licenseNumber: z
			.string("License number is required")
			.trim()
			.min(3, "License number is required")
			.max(100, "License number must not exceed 100 characters"),

		qualifications: z
			.string("Qualifications are required")
			.trim()
			.min(2, "Qualifications are required")
			.max(500, "Qualifications must not exceed 500 characters"),

		experienceYears: z.coerce
			.number("Experience years is required")
			.int("Experience years must be a whole number")
			.min(0, "Experience years cannot be negative")
			.max(70, "Experience years must not exceed 70"),

		bio: z
			.string()
			.trim()
			.max(2000, "Bio must not exceed 2000 characters")
			.optional(),

		consultationFee: z.coerce
			.number()
			.nonnegative("Consultation fee cannot be negative")
			.max(99999999.99, "Consultation fee is too large")
			.optional(),

		contactNumber: z
			.string()
			.trim()
			.min(7, "Contact number is too short")
			.max(20, "Contact number is too long")
			.optional(),
	}),
});

export const VerifyDoctorEmailSchema = z.object({
	email: z.string().email("Not a valid email address"),
	otp: z.string().length(6, { message: "OTP must be 6 digits long" }),
});

export const ApproveDoctorSchema = z
	.object({
		doctorId: z.string().uuid("Doctor ID must be a valid"),
		verificationStatus: z.enum(
			[DoctorVerificationStatus.VERIFIED, DoctorVerificationStatus.REJECTED],
			{
				error: "Approval status must be either VERIFIED or REJECTED",
			},
		),
		rejectionReason: z.string().optional(),
	})
	.refine(
		(data) =>
			data.verificationStatus === "VERIFIED" ||
			Boolean(data.rejectionReason?.trim()),
		{
			message: "Rejection reason is required when rejecting a doctor",
			path: ["rejectionReason"],
		},
	);

export const UpdateDoctorProfileSchema = z.object({
	address: z
		.string()
		.trim()
		.max(255, "Address must not exceed 255 characters")
		.optional(),

	bio: z
		.string()
		.trim()
		.max(2000, "Bio must not exceed 2000 characters")
		.optional(),

	consultationFee: z.coerce
		.number()
		.nonnegative("Consultation fee cannot be negative")
		.max(99999999.99, "Consultation fee is too large")
		.optional(),

	contactNumber: z
		.string()
		.trim()
		.min(7, "Contact number is too short")
		.max(20, "Contact number is too long")
		.optional(),

	imageUrl: z
		.string()
		.trim()
		.url("Please provide a valid image URL")
		.or(z.literal(""))
		.optional(),
});

export const DoctorIdParamSchema = z.object({
	doctorId: z.string().uuid("Doctor ID must be a valid UUID"),
});

// Type definitions for the validation schemas
export type IApplyAsDoctorPayload = z.infer<typeof ApplyAsDoctorSchema>;
export type IVerifyDoctorEmailPayload = z.infer<typeof VerifyDoctorEmailSchema>;
export type IApproveDoctorPayload = z.infer<typeof ApproveDoctorSchema>;
export type IUpdateDoctorProfilePayload = z.infer<typeof UpdateDoctorProfileSchema>;
export type IDoctorIdParamPayload = z.infer<typeof DoctorIdParamSchema>;

// Exporting the validation schemas for use in other parts of the application
export const doctorValidationSchemas = {
	ApplyAsDoctorSchema,
	VerifyDoctorEmailSchema,
	ApproveDoctorSchema,
	UpdateDoctorProfileSchema,
	DoctorIdParamSchema,
};

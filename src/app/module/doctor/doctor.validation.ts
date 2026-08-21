import { z } from "zod";

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

export type IApplyAsDoctorPayload = z.infer<
    typeof ApplyAsDoctorSchema
>;


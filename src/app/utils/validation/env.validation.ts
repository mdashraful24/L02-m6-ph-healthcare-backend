import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	PORT: z
		.preprocess(
			(val) => (typeof val === "string" ? Number(val) : val),
			z.number().int().positive().default(5000),
		),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	APP_URL: z.string().url().optional(),
	FRONTEND_URL: z.string().min(1, "FRONTEND_URL is required"),

	BCRYPT_SALT_ROUNDS: z.string().optional(),

	JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
	JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
	JWT_ACCESS_EXPIRES_IN: z.string().min(1, "JWT_ACCESS_EXPIRES_IN is required"),
	JWT_REFRESH_EXPIRES_IN: z
		.string()
		.min(1, "JWT_REFRESH_EXPIRES_IN is required"),

	GOOGLE_CLIENT_ID: z.string().optional(),

	SUPER_ADMIN_NAME: z.string().min(1),
	SUPER_ADMIN_EMAIL: z.string().email(),
	SUPER_ADMIN_PASSWORD: z.string().min(1),

	TESTER_ADMIN_NAME: z.string().optional(),
	TESTER_ADMIN_EMAIL: z.string().email().optional(),
	TESTER_ADMIN_PASSWORD: z.string().optional(),

	TESTER_DOCTOR_NAME: z.string().optional(),
	TESTER_DOCTOR_EMAIL: z.string().email().optional(),
	TESTER_DOCTOR_PASSWORD: z.string().optional(),

	REDIS_USER: z.string().optional(),
	REDIS_PASSWORD: z.string().optional(),
	REDIS_HOST: z.string().min(1),
	REDIS_PORT: z.preprocess(
		(val) => (typeof val === "string" ? Number(val) : val),
		z.number().int().positive(),
	),

	SMTP_USER: z.string().optional(),
	SMTP_PASSWORD: z.string().optional(),
	EMAIL_SENDER: z.string().optional(),

	CLOUDINARY_CLOUD_NAME: z.string().optional(),
	CLOUDINARY_API_KEY: z.string().optional(),
	CLOUDINARY_API_SECRET: z.string().optional(),

	BKASH_BASE_URL: z.string().url().optional(),
	BKASH_USERNAME: z.string().optional(),
	BKASH_PASSWORD: z.string().optional(),
	BKASH_APP_KEY: z.string().optional(),
	BKASH_APP_SECRET: z.string().optional(),
	BKASH_CALLBACK_URL: z.string().url().optional(),

	BOOKING_CUTOFF_MINUTES: z
		.preprocess(
			(val) => (typeof val === "string" ? Number(val) : val),
			z.number().int().nonnegative(),
		)
		.default(30),

	OPENROUTER_API_KEY: z.string().optional(),
	OPENROUTER_CHAT_MODEL: z.string().optional(),
	OPENROUTER_FALLBACK_CHAT_MODEL: z.string().optional(),
	OPENROUTER_EMBEDDING_MODEL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const validateEnv = (): EnvConfig => {
	try {
		const parsed = envSchema.parse(process.env);
		return parsed;
	} catch (error) {
		if (error instanceof z.ZodError) {
			const errorMessages = error.issues
				.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
				.join("\n");
			console.error("❌ Invalid environment variables:\n", errorMessages);
			process.exit(1);
		}
		throw error;
	}
};

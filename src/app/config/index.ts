import dotenv from "dotenv";
import path from "path";
import { validateEnv } from "../utils/validation/env.validation";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const env = validateEnv();

export default {
	node_env: env.NODE_ENV,
	port: env.PORT,
	database_url: env.DATABASE_URL,
	bak_url: env.APP_URL,
	frontend_url: env.FRONTEND_URL,

	bcrypt_salt_rounds: env.BCRYPT_SALT_ROUNDS,

	jwt_access_secret: env.JWT_ACCESS_SECRET,
	jwt_refresh_secret: env.JWT_REFRESH_SECRET,
	jwt_access_expires_in: env.JWT_ACCESS_EXPIRES_IN,
	jwt_refresh_expires_in: env.JWT_REFRESH_EXPIRES_IN,

	google_client_id: env.GOOGLE_CLIENT_ID,

	super_admin_name: env.SUPER_ADMIN_NAME,
	super_admin_email: env.SUPER_ADMIN_EMAIL,
	super_admin_password: env.SUPER_ADMIN_PASSWORD,

	tester_admin_name: env.TESTER_ADMIN_NAME,
	tester_admin_email: env.TESTER_ADMIN_EMAIL,
	tester_admin_password: env.TESTER_ADMIN_PASSWORD,

	tester_doctor_name: env.TESTER_DOCTOR_NAME,
	tester_doctor_email: env.TESTER_DOCTOR_EMAIL,
	tester_doctor_password: env.TESTER_DOCTOR_PASSWORD,

	redis_user: env.REDIS_USER,
	redis_password: env.REDIS_PASSWORD,
	redis_host: env.REDIS_HOST,
	redis_port: env.REDIS_PORT,

	smtp_user: env.SMTP_USER,
	smtp_password: env.SMTP_PASSWORD,

	email_sender: env.EMAIL_SENDER,

	cloudinary_cloud_name: env.CLOUDINARY_CLOUD_NAME,
	cloudinary_api_key: env.CLOUDINARY_API_KEY,
	cloudinary_api_secret: env.CLOUDINARY_API_SECRET,

	bkash_base_url: env.BKASH_BASE_URL,
	bkash_username: env.BKASH_USERNAME,
	bkash_password: env.BKASH_PASSWORD,
	bkash_app_key: env.BKASH_APP_KEY,
	bkash_app_secret: env.BKASH_APP_SECRET,
	bkash_callback_url: env.BKASH_CALLBACK_URL,

	booking_cutoff_minutes: env.BOOKING_CUTOFF_MINUTES,

	openrouter_api_key: env.OPENROUTER_API_KEY!,
	openrouter_chat_model: env.OPENROUTER_CHAT_MODEL!,
	openrouter_fallback_chat_models: env.OPENROUTER_FALLBACK_CHAT_MODELS!,
	openrouter_embedding_model: env.OPENROUTER_EMBEDDING_MODEL!,
};

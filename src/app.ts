import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import httpStatus from "http-status";
import qs from "qs";
// Config & libraries
import config from "./app/config";
import { getBkashIdToken } from "./app/lib/bkash";
// Middleware
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
// Routes
import { AppointmentRoutes } from "./app/module/appointment/appointment.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { DoctorRoutes } from "./app/module/doctor/doctor.route";
import { UserRoutes } from "./app/module/user/user.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { PaymentRoute } from "./app/module/payment/payment.route";
import { PrescriptionRoutes } from "./app/module/prescription/prescription.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { requestLogger } from "./app/middleware/requestLogger";
import path from "path";
import { ChatRoutes } from "./app/module/chat/chat.routes";

const app: Application = express();

// Trust proxy in production (behind reverse proxy like nginx/load balancer)
if (config.node_env === "production") {
	app.set("trust proxy", 1);
}

app.set("query parser", (str: string) => qs.parse(str));

app.set("view engine", "ejs");
app.set("views", path.resolve(__dirname, "./templates"));

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: config.node_env === "production" ? 100 : 1000, // limit each IP
	standardHeaders: true,
	legacyHeaders: false,
	message: {
		success: false,
		message: "Too many requests from this IP, please try again later.",
	},
});

app.use(limiter);

app.use(requestLogger);

const allowedOrigins = config.frontend_url
	? String(config.frontend_url)
			.split(",")
			.map((origin) => origin.trim())
			.filter(Boolean)
	: [];

app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps, Postman, etc.)
			if (!origin) return callback(null, true);
			if (allowedOrigins.includes(origin)) {
				return callback(null, true);
			}
			if (config.node_env !== "production") {
				return callback(null, true);
			}
			callback(new Error("Not allowed by CORS"));
		},
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Middleware to parse JSON bodies
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/appointment", AppointmentRoutes);
app.use("/api/v1/doctor", DoctorRoutes);
app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/payment", PaymentRoute);
app.use("/api/v1/prescription", PrescriptionRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);
// RAG implemented chat routes
app.use("/api/v1/chat", ChatRoutes);

// Testing - only available in development
if (config.node_env !== "production") {
	app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
		try {
			await getBkashIdToken();
			res.status(httpStatus.OK).json({
				success: true,
				message: "PH Healthcare System Server is running successfully",
				// data: null,
			});
		} catch (error) {
			console.log(error);
			next(error);
		}
	});
}

// Health check route
app.get("/health", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Server is healthy",
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	});
});

// Basic route
app.get("/", async (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare Management System Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;

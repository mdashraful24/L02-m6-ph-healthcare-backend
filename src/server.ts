import app from "./app";
import config from "./app/config";
import { deleteUnverifiedDoctors } from "./app/lib/cron";
import { transporter } from "./app/lib/nodemailer";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";
import {
	seedSuperAdmin,
	seedTesterAdmin,
	seedTesterDoctor,
} from "./app/utils/seed";
import logger from "./app/logger";

const PORT = config.port;

const main = async () => {
	try {
		await prisma.$connect();
		logger.info("Connected to the database successfully.");

		await redisClient.connect();
		logger.info("Redis Connected Successfully.");

		await transporter.verify();
		logger.info("Nodemailer Connected Successfully.");

		await seedSuperAdmin();
		await seedTesterAdmin();
		await seedTesterDoctor();

		await deleteUnverifiedDoctors();

		const server = app.listen(PORT, () => {
			logger.info(`Server is running on port ${PORT}`);
		});

		// Graceful shutdown
		const shutdown = (signal: string) => {
			logger.info(`${signal} received. Shutting down gracefully...`);
			server.close(async () => {
				try {
					await prisma.$disconnect();
					await redisClient.disconnect();
					logger.info("Database and Redis disconnected. Exiting.");
					process.exit(0);
				} catch (error) {
					logger.error("Error during graceful shutdown:", error);
					process.exit(1);
				}
			});

			// Force shutdown after 10 seconds
			setTimeout(() => {
				logger.error("Forced shutdown after timeout");
				process.exit(1);
			}, 10000);
		};

		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("SIGTERM", () => shutdown("SIGTERM"));

		process.on("unhandledRejection", (reason) => {
			logger.error("Unhandled Rejection:", reason);
		});

		process.on("uncaughtException", (error) => {
			logger.error("Uncaught Exception:", error);
			process.exit(1);
		});
	} catch (error) {
		logger.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

main();

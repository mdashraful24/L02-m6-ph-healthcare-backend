import fs from "fs/promises";
import path from "path";
import { NextFunction, Request, Response } from "express";
import config from "../config";
import logger from "../logger";

const logDir = path.resolve(process.cwd(), "logs");
const accessLogPath = path.join(logDir, "access.log");

const ensureLogDir = async () => {
	await fs.mkdir(logDir, { recursive: true });
};

export const requestLogger = async (req: Request, res: Response, next: NextFunction) => {
	const startTime = process.hrtime.bigint();

	res.on("finish", async () => {
		try {
			const endTime = process.hrtime.bigint();
			const responseTimeMs = Number(endTime - startTime) / 1_000_000;
			const logData = {
				timestamp: new Date().toISOString(),
				method: req.method,
				endpoint: req.originalUrl,
				statusCode: res.statusCode,
				responseTimeMs: Number(responseTimeMs.toFixed(2)),
				ip: req.ip,
				userAgent: req.get("user-agent") || "unknown",
			};

			if (config.node_env === "development") {
				console.log("Request processed:", logData);
			}

			const logEntry = JSON.stringify(logData);

			if (config.node_env === "development") {
				logger.debug("Request processed", logData);
			}

			await ensureLogDir();
			await fs.appendFile(accessLogPath, `${logEntry}\n`, "utf8");
		} catch (error) {
			logger.error("Failed to write access log:", error);
		}
	});

	next();
};

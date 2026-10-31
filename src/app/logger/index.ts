import winston from "winston";
import config from "../config";

const logFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.splat(),
	winston.format.json(),
);

const logger = winston.createLogger({
	level: config.node_env === "production" ? "info" : "debug",
	format: logFormat,
	defaultMeta: { service: "ph-healthcare-server" },
	transports: [
		new winston.transports.Console({
			format:
				config.node_env === "development"
					? winston.format.combine(
						winston.format.colorize(),
						winston.format.printf(
							({ level, message, timestamp, stack }) => {
								return `${timestamp} [${level}]: ${stack || message}`;
							},
						),
					)
					: logFormat,
		}),
	],
});

export default logger;

import winston from "winston";

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== "production";

export const logger = winston.createLogger({
  level: isDev ? "debug" : "info",
  format: combine(errors({ stack: true }), timestamp(), json()),
  defaultMeta: { service: "rag-pdf-chatbot" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (isDev) {
  logger.add(
    new winston.transports.Console({ format: combine(colorize(), simple()) })
  );
}

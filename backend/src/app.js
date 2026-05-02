import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./config/env.js";
import documentsRouter from "./routes/documents.route.js";
import chatRouter from "./routes/chat.route.js";
import healthRouter from "./routes/health.route.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Parsing & Logging ────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(config.NODE_ENV === "development" ? "dev" : "combined"));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/health", healthRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/chat", chatRouter);

// ─── Error Handling ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

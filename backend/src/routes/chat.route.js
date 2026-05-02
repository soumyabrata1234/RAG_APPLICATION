import { Router } from "express";
import rateLimit from "express-rate-limit";
import { queryDocument, streamQueryDocument } from "../services/rag.service.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

// Prevent API abuse — 30 queries per minute per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/chat/query
 * Standard (non-streaming) RAG query.
 *
 * Body: { documentId: string, question: string }
 */
router.post(
  "/query",
  chatLimiter,
  asyncHandler(async (req, res) => {
    const { documentId, question } = req.body;

    if (!documentId || typeof documentId !== "string") {
      return res.status(400).json({ success: false, error: "documentId is required." });
    }
    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return res.status(400).json({ success: false, error: "question must be at least 3 characters." });
    }
    if (question.length > 2000) {
      return res.status(400).json({ success: false, error: "question exceeds 2000 characters." });
    }

    const { answer, sources } = await queryDocument(documentId, question.trim());

    res.json({
      success: true,
      data: { answer, sources, documentId, question: question.trim() },
    });
  })
);

/**
 * POST /api/chat/stream
 * Server-Sent Events (SSE) streaming RAG query.
 *
 * Body: { documentId: string, question: string }
 * Events: sources → token (multiple) → done
 */
router.post(
  "/stream",
  chatLimiter,
  asyncHandler(async (req, res) => {
    const { documentId, question } = req.body;

    if (!documentId || !question?.trim()) {
      return res.status(400).json({ success: false, error: "documentId and question are required." });
    }

    await streamQueryDocument(documentId, question.trim(), res);
  })
);

export default router;

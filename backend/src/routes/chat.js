import express from "express";
import { z } from "zod";
import { runRAGQuery, streamRAGQuery } from "../services/ragService.js";
import { documentRegistry } from "./documents.js";

const router = express.Router();

// In-memory conversation history (use Redis in production)
const conversationHistory = new Map();

const chatSchema = z.object({
  question: z.string().min(1, "Question is required").max(2000),
  documentId: z.string().uuid("Invalid document ID"),
  conversationId: z.string().optional().nullable(),
  stream: z.boolean().optional().default(false),
});

/**
 * POST /api/chat
 * Send a question to the RAG pipeline
 */
router.post("/", async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
  }

  const { question, documentId, conversationId, stream } = parsed.data;

  // Verify document exists
  if (!documentRegistry.has(documentId)) {
    return res.status(404).json({ error: "Document not found. Please upload a PDF first." });
  }

  const convId = conversationId || documentId;
  const history = conversationHistory.get(convId) || [];

  // Streaming response
  if (stream) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const { answer, sourceDocuments } = await streamRAGQuery(
        question,
        documentId,
        history,
        (token) => {
          res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
        }
      );

      // Save to history
      history.push({ role: "user", content: question });
      history.push({ role: "assistant", content: answer });
      if (history.length > 20) history.splice(0, 2); // Keep last 10 turns
      conversationHistory.set(convId, history);

      res.write(`data: ${JSON.stringify({ type: "done", sourceDocuments, conversationId: convId })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`);
      res.end();
    }
    return;
  }

  // Non-streaming response
  try {
    const { answer, sourceDocuments } = await runRAGQuery(question, documentId, history);

    history.push({ role: "user", content: question });
    history.push({ role: "assistant", content: answer });
    if (history.length > 20) history.splice(0, 2);
    conversationHistory.set(convId, history);

    res.json({
      answer,
      sourceDocuments,
      conversationId: convId,
      historyLength: history.length / 2,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Failed to process question", details: error.message });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Retrieve conversation history
 */
router.get("/history/:conversationId", (req, res) => {
  const history = conversationHistory.get(req.params.conversationId) || [];
  res.json({ history, total: history.length });
});

/**
 * DELETE /api/chat/history/:conversationId
 * Clear conversation history
 */
router.delete("/history/:conversationId", (req, res) => {
  conversationHistory.delete(req.params.conversationId);
  res.json({ success: true, message: "Conversation history cleared" });
});

export const chatRoutes = router;

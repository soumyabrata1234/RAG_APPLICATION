import { Router } from "express";
import { getPineconeClient } from "../config/pinecone.js";
import { config } from "../config/env.js";

const router = Router();

/**
 * GET /api/health
 * Returns service status and basic diagnostics.
 */
router.get("/", async (req, res) => {
  const checks = { server: "ok", pinecone: "unknown" };

  try {
    const client = getPineconeClient();
    await client.listIndexes();
    checks.pinecone = "ok";
  } catch {
    checks.pinecone = "error";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  res.status(allOk ? 200 : 503).json({
    success: allOk,
    status: allOk ? "healthy" : "degraded",
    checks,
    env: config.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

export default router;

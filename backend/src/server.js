import app from "./app.js";
import { config } from "./config/env.js";
import { ensureIndexExists } from "./config/pinecone.js";

async function bootstrap() {
  console.log("🚀 Starting RAG PDF Chatbot server...");

  // Verify Pinecone index is ready before accepting traffic
  await ensureIndexExists();

  const server = app.listen(config.PORT, () => {
    console.log(`✅ Server running on http://localhost:${config.PORT}`);
    console.log(`   Environment : ${config.NODE_ENV}`);
    console.log(`   Chat model  : ${config.CHAT_MODEL}`);
    console.log(`   Embeddings  : ${config.EMBEDDING_MODEL}`);
    console.log(`   Pinecone    : ${config.PINECONE_INDEX_NAME}`);
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────────────────
  const shutdown = (signal) => {
    console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log("👋 Server closed.");
      process.exit(0);
    });

    // Force exit if shutdown takes too long
    setTimeout(() => process.exit(1), 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    console.error("💥 Unhandled rejection:", reason);
  });
}

bootstrap().catch((err) => {
  console.error("💥 Failed to start server:", err);
  process.exit(1);
});

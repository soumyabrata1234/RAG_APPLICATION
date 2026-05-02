import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default("5000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  GOOGLE_API_KEY: z.string().min(1, "GOOGLE_API_KEY is required"),
  PINECONE_API_KEY: z.string().min(1, "PINECONE_API_KEY is required"),
  PINECONE_INDEX_NAME: z.string().default("pdf-rag-index"),
  PINECONE_CLOUD: z.string().default("aws"),
  PINECONE_REGION: z.string().default("us-east-1"),
  MAX_FILE_SIZE_MB: z.string().default("50"),
  UPLOAD_DIR: z.string().default("./uploads"),
  RATE_LIMIT_WINDOW_MS: z.string().default("900000"),
  RATE_LIMIT_MAX: z.string().default("100"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:\n", parsed.error.format());
  process.exit(1);
}

export const env = {
  port: parseInt(parsed.data.PORT, 10),
  nodeEnv: parsed.data.NODE_ENV,
  googleApiKey: parsed.data.GOOGLE_API_KEY,
  pinecone: {
    apiKey: parsed.data.PINECONE_API_KEY,
    indexName: parsed.data.PINECONE_INDEX_NAME,
    cloud: parsed.data.PINECONE_CLOUD,
    region: parsed.data.PINECONE_REGION,
  },
  upload: {
    maxFileSizeMb: parseInt(parsed.data.MAX_FILE_SIZE_MB, 10),
    dir: parsed.data.UPLOAD_DIR,
  },
  rateLimit: {
    windowMs: parseInt(parsed.data.RATE_LIMIT_WINDOW_MS, 10),
    max: parseInt(parsed.data.RATE_LIMIT_MAX, 10),
  },
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(","),
};

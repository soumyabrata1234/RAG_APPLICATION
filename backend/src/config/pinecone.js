import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

let pineconeClient = null;

export async function getPineconeClient() {
  if (pineconeClient) return pineconeClient;

  pineconeClient = new Pinecone({ apiKey: env.pinecone.apiKey });
  logger.info("Pinecone client initialized");
  return pineconeClient;
}

export async function ensureIndexExists() {
  const client = await getPineconeClient();
  const indexName = env.pinecone.indexName;

  const existingIndexes = await client.listIndexes();
  const exists = existingIndexes.indexes?.some((idx) => idx.name === indexName);

  if (!exists) {
    logger.info(`Creating Pinecone index: ${indexName}`);
    await client.createIndex({
      name: indexName,
      dimension: 3072, // gemini-embedding-2 dimensions
      metric: "cosine",
      spec: {
        serverless: {
          cloud: env.pinecone.cloud,
          region: env.pinecone.region,
        },
      },
    });

    // Wait for index to be ready
    let ready = false;
    while (!ready) {
      await new Promise((r) => setTimeout(r, 2000));
      const description = await client.describeIndex(indexName);
      ready = description.status?.ready === true;
      logger.info(`Index status: ${description.status?.state}`);
    }
    logger.info(`✅ Index "${indexName}" is ready`);
  } else {
    logger.info(`✅ Using existing Pinecone index: "${indexName}"`);
  }

  return client.index(indexName);
}

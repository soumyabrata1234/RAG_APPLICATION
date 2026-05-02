import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;

/**
 * Singleton Pinecone client initializer
 */
export const getPineconeClient = () => {
  if (!pineconeClient) {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set in environment variables");
    }
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return pineconeClient;
};

/**
 * Get or create a Pinecone index
 */
export const getPineconeIndex = async () => {
  const client = getPineconeClient();
  const indexName = process.env.PINECONE_INDEX_NAME || "rag-pdf-chatbot";

  const existingIndexes = await client.listIndexes();
  const indexExists = existingIndexes.indexes?.some((idx) => idx.name === indexName);

  if (!indexExists) {
    console.log(`Creating Pinecone index: ${indexName}`);
    await client.createIndex({
      name: indexName,
      dimension: 3072, // gemini-embedding-2 dimensions
      metric: "cosine",
      spec: {
        serverless: {
          cloud: process.env.PINECONE_CLOUD || "aws",
          region: process.env.PINECONE_REGION || "us-east-1",
        },
      },
    });

    // Wait for index to be ready
    await new Promise((resolve) => setTimeout(resolve, 10000));
    console.log(`Index ${indexName} created successfully`);
  }

  return client.Index(indexName);
};

/**
 * Delete all vectors for a specific namespace (document)
 */
export const deleteNamespace = async (namespace) => {
  const index = await getPineconeIndex();
  await index.namespace(namespace).deleteAll();
};

/**
 * List all namespaces (documents) stored in Pinecone
 */
export const listNamespaces = async () => {
  const index = await getPineconeIndex();
  const stats = await index.describeIndexStats();
  return stats.namespaces ? Object.keys(stats.namespaces) : [];
};

/**
 * Get stats for a specific namespace
 */
export const getNamespaceStats = async (namespace) => {
  const index = await getPineconeIndex();
  const stats = await index.describeIndexStats();
  return stats.namespaces?.[namespace] || { vectorCount: 0 };
};

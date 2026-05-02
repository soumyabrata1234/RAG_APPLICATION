import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getPineconeIndex } from "./pineconeService.js";

/**
 * Create Google Generative AI embeddings instance
 */
export const getEmbeddings = () => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "gemini-embedding-2",
  });
};

/**
 * Split text into chunks suitable for embedding
 */
export const splitTextIntoChunks = async (text, metadata = {}) => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " ", ""],
  });

  const docs = await splitter.createDocuments([text], [metadata]);
  return docs;
};

/**
 * Store document embeddings in Pinecone
 * @param {Array} docs - LangChain Document objects
 * @param {string} namespace - Pinecone namespace (document ID)
 */
export const storeEmbeddings = async (docs, namespace) => {
  const embeddings = getEmbeddings();
  const pineconeIndex = await getPineconeIndex();

  const vectorStore = await PineconeStore.fromDocuments(docs, embeddings, {
    pineconeIndex,
    namespace,
    maxConcurrency: 5,
  });

  return vectorStore;
};

/**
 * Retrieve a vector store for similarity search
 * @param {string} namespace - Pinecone namespace
 */
export const getVectorStore = async (namespace) => {
  const embeddings = getEmbeddings();
  const pineconeIndex = await getPineconeIndex();

  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace,
  });
};

/**
 * Perform similarity search across namespaces or a specific one
 * @param {string} query - User's question
 * @param {string[]} namespaces - Document namespaces to search
 * @param {number} k - Number of results per namespace
 */
export const similaritySearch = async (query, namespaces, k = 4) => {
  const embeddings = getEmbeddings();
  const pineconeIndex = await getPineconeIndex();
  const allDocs = [];

  for (const namespace of namespaces) {
    const store = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      namespace,
    });

    const docs = await store.similaritySearchWithScore(query, k);
    allDocs.push(...docs.map(([doc, score]) => ({ ...doc, score, namespace })));
  }

  // Sort by relevance score (descending) and take top k
  return allDocs.sort((a, b) => b.score - a.score).slice(0, k * 2);
};

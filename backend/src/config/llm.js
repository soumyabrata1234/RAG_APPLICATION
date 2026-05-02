import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { config } from "../config/env.js";

let embeddingsInstance = null;
let chatInstance = null;

/**
 * Returns a singleton Google Generative AI embeddings instance.
 */
export function getEmbeddings() {
  if (!embeddingsInstance) {
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      apiKey: config.GOOGLE_API_KEY,
      modelName: config.EMBEDDING_MODEL,
    });
  }
  return embeddingsInstance;
}

/**
 * Returns a singleton ChatGoogleGenerativeAI instance (streaming-capable).
 */
export function getChatModel(streaming = false) {
  if (!chatInstance || streaming) {
    return new ChatGoogleGenerativeAI({
      apiKey: config.GOOGLE_API_KEY,
      modelName: config.CHAT_MODEL,
      temperature: 0.2,
      streaming,
    });
  }
  return chatInstance;
}

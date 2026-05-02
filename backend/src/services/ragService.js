import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { getVectorStore } from "./embeddingService.js";

/**
 * Get LLM instance
 */
const getLLM = (streaming = false) => {
  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is not set in environment variables");
  }
  return new ChatGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY,
    modelName: "gemini-2.5-flash",
    temperature: 0.2,
    streaming,
  });
};

/**
 * Build the history-aware RAG chain
 */
const buildRAGChain = async (namespace) => {
  const llm = getLLM();
  const vectorStore = await getVectorStore(namespace);
  const retriever = vectorStore.asRetriever({ k: 5 });

  // Prompt to reformulate question given history
  const historyAwarePrompt = ChatPromptTemplate.fromMessages([
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    [
      "human",
      "Given the above conversation, generate a search query to look up relevant information from the document. Return only the query, nothing else.",
    ],
  ]);

  const historyAwareRetriever = await createHistoryAwareRetriever({
    llm,
    retriever,
    rephrasePrompt: historyAwarePrompt,
  });

  // Main RAG prompt
  const ragPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are an expert document analyst with deep knowledge of the uploaded PDF. 
Answer questions accurately and thoroughly based ONLY on the provided context.

Guidelines:
- Provide detailed, structured answers when the context supports it
- Use bullet points or numbered lists for complex answers
- Quote relevant passages from the document when helpful (use > for blockquotes)
- If the answer isn't in the context, clearly state: "This information is not found in the document"
- Never make up information not present in the context
- Cite page numbers if available in the metadata

Context from document:
{context}`,
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const documentChain = await createStuffDocumentsChain({ llm, prompt: ragPrompt });

  return createRetrievalChain({
    retriever: historyAwareRetriever,
    combineDocsChain: documentChain,
  });
};

/**
 * Convert raw chat history to LangChain message format
 */
const formatChatHistory = (history) => {
  return history.flatMap(({ role, content }) =>
    role === "user" ? [new HumanMessage(content)] : [new AIMessage(content)]
  );
};

/**
 * Run RAG query
 * @param {string} question - User's question
 * @param {string} namespace - Document namespace in Pinecone
 * @param {Array} chatHistory - Previous conversation messages
 */
export const runRAGQuery = async (question, namespace, chatHistory = []) => {
  const chain = await buildRAGChain(namespace);
  const formattedHistory = formatChatHistory(chatHistory);

  const response = await chain.invoke({
    input: question,
    chat_history: formattedHistory,
  });

  return {
    answer: response.answer,
    sourceDocuments: response.context?.map((doc) => ({
      content: doc.pageContent.substring(0, 200) + "...",
      metadata: doc.metadata,
    })) || [],
  };
};

/**
 * Stream RAG query response
 * @param {string} question - User's question
 * @param {string} namespace - Document namespace in Pinecone
 * @param {Array} chatHistory - Previous conversation messages
 * @param {Function} onToken - Callback for each streamed token
 */
export const streamRAGQuery = async (question, namespace, chatHistory = [], onToken) => {
  const llm = getLLM(true);
  const vectorStore = await getVectorStore(namespace);
  const retriever = vectorStore.asRetriever({ k: 5 });
  const formattedHistory = formatChatHistory(chatHistory);

  // Retrieve relevant docs first
  const relevantDocs = await retriever.invoke(question);

  const context = relevantDocs.map((d) => d.pageContent).join("\n\n---\n\n");

  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      `You are an expert document analyst. Answer questions based ONLY on the following document context.
If the answer is not in the context, say so clearly. Never fabricate information.

Context:
${context}`,
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const chain = prompt.pipe(llm);
  const stream = await chain.stream({
    input: question,
    chat_history: formattedHistory,
  });

  let fullResponse = "";
  for await (const chunk of stream) {
    const token = chunk.content;
    if (token) {
      fullResponse += token;
      onToken(token);
    }
  }

  return {
    answer: fullResponse,
    sourceDocuments: relevantDocs.map((doc) => ({
      content: doc.pageContent.substring(0, 200) + "...",
      metadata: doc.metadata,
    })),
  };
};

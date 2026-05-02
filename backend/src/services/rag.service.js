import { PineconeStore } from "@langchain/pinecone";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { config } from "../config/env.js";
import { getEmbeddings, getChatModel } from "../config/llm.js";
import { getPineconeClient } from "../config/pinecone.js";

const SYSTEM_PROMPT = `You are an expert document analyst. Your task is to answer questions
strictly based on the provided context extracted from the user's PDF document.

Rules:
- Answer ONLY from the context below. Do not use prior knowledge.
- If the context does not contain enough information, say: "I couldn't find that in this document."
- Be concise but thorough. Use bullet points or numbered lists when appropriate.
- When quoting the document, use quotation marks.
- Always cite the page number(s) when referencing specific content.

Context:
{context}`;

/**
 * Builds a LangChain LCEL RAG chain for a given document namespace.
 *
 * Pipeline:
 *   question → retriever → format docs → prompt → LLM → string
 *
 * @param {string} documentId - Pinecone namespace
 * @param {boolean} streaming - Whether to stream the response
 */
export async function buildRAGChain(documentId, streaming = false) {
  const client = getPineconeClient();
  const index = client.index(config.PINECONE_INDEX_NAME);

  // Vector store scoped to this document's namespace
  const vectorStore = await PineconeStore.fromExistingIndex(getEmbeddings(), {
    pineconeIndex: index,
    namespace: documentId,
  });

  const retriever = vectorStore.asRetriever({
    k: config.RETRIEVAL_TOP_K,
    searchType: "similarity",
  });

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT),
    HumanMessagePromptTemplate.fromTemplate("{question}"),
  ]);

  const llm = getChatModel(streaming);

  // LCEL chain (LangChain Expression Language)
  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  return { chain, retriever };
}

/**
 * Runs a RAG query and returns the answer + source chunks.
 *
 * @param {string} documentId
 * @param {string} question
 * @returns {{ answer: string, sources: Array<{pageContent, metadata}> }}
 */
export async function queryDocument(documentId, question) {
  const { chain, retriever } = await buildRAGChain(documentId, false);

  // Run retrieval and generation in parallel
  const [answer, sourceDocs] = await Promise.all([
    chain.invoke(question),
    retriever.invoke(question),
  ]);

  const sources = sourceDocs.map((doc) => ({
    pageContent: doc.pageContent.slice(0, 300) + (doc.pageContent.length > 300 ? "…" : ""),
    metadata: {
      page: doc.metadata.loc?.pageNumber ?? doc.metadata.page ?? "unknown",
      chunkIndex: doc.metadata.chunkIndex,
      source: doc.metadata.source,
    },
  }));

  return { answer, sources };
}

/**
 * Streams a RAG response via Server-Sent Events.
 *
 * @param {string} documentId
 * @param {string} question
 * @param {import('express').Response} res - Express response (SSE)
 */
export async function streamQueryDocument(documentId, question, res) {
  const { chain, retriever } = await buildRAGChain(documentId, true);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Retrieve source docs first (non-streaming)
  const sourceDocs = await retriever.invoke(question);
  const sources = sourceDocs.map((doc) => ({
    pageContent: doc.pageContent.slice(0, 300) + (doc.pageContent.length > 300 ? "…" : ""),
    metadata: {
      page: doc.metadata.loc?.pageNumber ?? doc.metadata.page ?? "unknown",
      chunkIndex: doc.metadata.chunkIndex,
    },
  }));

  // Send sources event before streaming begins
  res.write(`event: sources\ndata: ${JSON.stringify(sources)}\n\n`);

  // Stream the answer token by token
  const stream = await chain.stream(question);
  for await (const chunk of stream) {
    if (chunk) {
      res.write(`event: token\ndata: ${JSON.stringify({ token: chunk })}\n\n`);
    }
  }

  res.write(`event: done\ndata: {}\n\n`);
  res.end();
}

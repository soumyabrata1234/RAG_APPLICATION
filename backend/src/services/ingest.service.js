import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "@langchain/pinecone";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env.js";
import { getEmbeddings } from "../config/llm.js";
import { getPineconeClient } from "../config/pinecone.js";

/**
 * Ingests a PDF file into Pinecone:
 * 1. Parse PDF → raw Documents
 * 2. Split into chunks
 * 3. Embed + upsert to a namespace keyed by documentId
 *
 * @param {string} filePath - Temp file path from multer
 * @param {string} originalName - Original filename for metadata
 * @returns {{ documentId, chunkCount, pageCount }}
 */
export async function ingestPDF(filePath, originalName) {
  const documentId = uuidv4();
  const startTime = Date.now();

  // Step 1: Load PDF
  console.log(`📄 Loading PDF: ${originalName}`);
  const loader = new PDFLoader(filePath, { splitPages: true });
  const rawDocs = await loader.load();

  const pageCount = rawDocs.length;
  console.log(`   → ${pageCount} pages loaded`);

  // Step 2: Split into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.CHUNK_SIZE,
    chunkOverlap: config.CHUNK_OVERLAP,
    separators: ["\n\n", "\n", ". ", " ", ""],
  });

  const chunks = await splitter.splitDocuments(rawDocs);

  // Attach rich metadata to every chunk
  const enrichedChunks = chunks.map((chunk, index) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      documentId,
      originalName,
      chunkIndex: index,
      totalChunks: chunks.length,
      ingestedAt: new Date().toISOString(),
    },
  }));

  console.log(`   → ${chunks.length} chunks created`);

  // Step 3: Embed + upsert to Pinecone (namespace = documentId for isolation)
  const client = getPineconeClient();
  const index = client.index(config.PINECONE_INDEX_NAME);

  await PineconeStore.fromDocuments(enrichedChunks, getEmbeddings(), {
    pineconeIndex: index,
    namespace: documentId,
    maxConcurrency: 5,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Ingested "${originalName}" in ${elapsed}s (${chunks.length} chunks → Pinecone)`);

  return { documentId, chunkCount: chunks.length, pageCount };
}

/**
 * Deletes all vectors in a document's namespace.
 * @param {string} documentId
 */
export async function deleteDocument(documentId) {
  const client = getPineconeClient();
  const index = client.index(config.PINECONE_INDEX_NAME);
  await index.namespace(documentId).deleteAll();
  console.log(`🗑️  Deleted namespace: ${documentId}`);
}

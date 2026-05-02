import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { extractTextFromPDF, cleanPDFText } from "../services/pdfService.js";
import { splitTextIntoChunks, storeEmbeddings } from "../services/embeddingService.js";
import { deleteNamespace } from "../services/pineconeService.js";

const router = express.Router();

// In-memory document registry (use Redis/DB in production)
export const documentRegistry = new Map();

// Multer: PDF only, memory storage, 25MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype === "application/pdf"
      ? cb(null, true)
      : cb(new Error("Only PDF files are accepted"), false);
  },
});

/**
 * POST /api/documents/upload
 * Upload and process a PDF document into Pinecone
 */
router.post("/upload", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file provided" });

  const documentId = uuidv4();
  const startTime = Date.now();

  try {
    console.log(`📄 Processing: ${req.file.originalname} (${req.file.size} bytes)`);

    // 1. Extract text
    const { text, numPages, metadata } = await extractTextFromPDF(req.file.buffer);
    const cleanedText = cleanPDFText(text);

    if (!cleanedText || cleanedText.length < 50) {
      return res.status(422).json({
        error: "Could not extract readable text. The PDF may be scanned or image-based.",
      });
    }

    // 2. Chunk text
    const chunks = await splitTextIntoChunks(cleanedText, {
      source: req.file.originalname,
      documentId,
      title: metadata.title,
      author: metadata.author,
      pages: numPages,
    });

    // 3. Embed + store in Pinecone
    await storeEmbeddings(chunks, documentId);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);

    const docRecord = {
      id: documentId,
      name: req.file.originalname,
      size: req.file.size,
      pages: numPages,
      chunks: chunks.length,
      metadata,
      uploadedAt: new Date().toISOString(),
      processingTime: `${processingTime}s`,
    };

    documentRegistry.set(documentId, docRecord);

    res.status(201).json({ success: true, document: docRecord });
  } catch (error) {
    console.error("Upload error:", error);
    try { await deleteNamespace(documentId); } catch (_) {}
    res.status(500).json({ error: "Failed to process document", details: error.message });
  }
});

/**
 * GET /api/documents
 */
router.get("/", (req, res) => {
  const documents = Array.from(documentRegistry.values());
  res.json({ documents, total: documents.length });
});

/**
 * GET /api/documents/:id
 */
router.get("/:id", (req, res) => {
  const doc = documentRegistry.get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json(doc);
});

/**
 * DELETE /api/documents/:id
 */
router.delete("/:id", async (req, res) => {
  const doc = documentRegistry.get(req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  try {
    await deleteNamespace(req.params.id);
    documentRegistry.delete(req.params.id);
    res.json({ success: true, message: `"${doc.name}" deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document", details: error.message });
  }
});

export const documentRoutes = router;

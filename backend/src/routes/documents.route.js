import { Router } from "express";
import fs from "fs/promises";
import { handleUpload } from "../middleware/upload.js";
import { ingestPDF, deleteDocument } from "../services/ingest.service.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

/**
 * POST /api/documents/upload
 * Accepts a PDF file, ingests it into Pinecone, returns documentId.
 */
router.post(
  "/upload",
  asyncHandler(async (req, res) => {
    await handleUpload(req, res);

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const { path: filePath, originalname } = req.file;

    try {
      const { documentId, chunkCount, pageCount } = await ingestPDF(filePath, originalname);

      res.status(201).json({
        success: true,
        data: {
          documentId,
          filename: originalname,
          chunkCount,
          pageCount,
          message: `Successfully ingested ${pageCount} pages (${chunkCount} chunks) into Pinecone.`,
        },
      });
    } finally {
      // Always clean up temp file
      await fs.unlink(filePath).catch(() => {});
    }
  })
);

/**
 * DELETE /api/documents/:documentId
 * Deletes all vectors for a document from Pinecone.
 */
router.delete(
  "/:documentId",
  asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId || documentId.length < 10) {
      return res.status(400).json({ success: false, error: "Invalid documentId." });
    }

    await deleteDocument(documentId);

    res.json({
      success: true,
      data: { message: `Document ${documentId} deleted from vector store.` },
    });
  })
);

export default router;

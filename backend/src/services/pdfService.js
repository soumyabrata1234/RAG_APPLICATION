import pdf from "pdf-parse/lib/pdf-parse.js";
import fs from "fs";

/**
 * Extract text and metadata from a PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 */
export const extractTextFromPDF = async (buffer) => {
  const data = await pdf(buffer);

  return {
    text: data.text,
    numPages: data.numpages,
    metadata: {
      title: data.info?.Title || "Unknown",
      author: data.info?.Author || "Unknown",
      subject: data.info?.Subject || "",
      creator: data.info?.Creator || "",
      pages: data.numpages,
    },
  };
};

/**
 * Extract text from a PDF file path
 * @param {string} filePath - Path to PDF file
 */
export const extractTextFromPDFPath = async (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return extractTextFromPDF(buffer);
};

/**
 * Clean extracted PDF text
 * - Remove excessive whitespace
 * - Fix common PDF extraction artifacts
 */
export const cleanPDFText = (text) => {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\f/g, "\n\n--- Page Break ---\n\n")
    .trim();
};

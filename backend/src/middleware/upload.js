import multer from "multer";
import path from "path";
import os from "os";

const MAX_FILE_SIZE_MB = 20;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `upload_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf" || file.originalname.endsWith(".pdf")) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are accepted."), false);
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
}).single("file");

/**
 * Wraps multer in a promise for cleaner async/await usage in routes.
 */
export function handleUpload(req, res) {
  return new Promise((resolve, reject) => {
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(new Error(`File too large. Max size: ${MAX_FILE_SIZE_MB}MB`));
        }
        return reject(new Error(err.message));
      }
      if (err) return reject(err);
      resolve();
    });
  });
}

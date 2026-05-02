/**
 * Global Express error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  console.error("Unhandled error:", err);

  // Multer errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ error: "File too large. Maximum size is 25MB." });
  }
  if (err.message === "Only PDF files are accepted") {
    return res.status(415).json({ error: err.message });
  }

  // API rate limit
  if (err.status === 429) {
    return res.status(429).json({ error: "Rate limit exceeded. Please try again shortly." });
  }

  // Default
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

import { useState, useRef, useCallback } from "react";
import { uploadPDF } from "../utils/api.js";

export function UploadZone({ onDocumentReady }) {
  const [state, setState] = useState("idle"); // idle | dragging | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      setState("error");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("File exceeds 20 MB limit.");
      setState("error");
      return;
    }

    setState("uploading");
    setError(null);
    setProgress(10);

    // Animate progress while waiting
    const interval = setInterval(() => setProgress((p) => Math.min(p + 5, 85)), 600);

    try {
      const data = await uploadPDF(file);
      clearInterval(interval);
      setProgress(100);
      setInfo(data);
      setState("done");
      setTimeout(() => onDocumentReady(data), 400);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
      setState("error");
    }
  }, [onDocumentReady]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setState("idle");
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const onDragOver = (e) => { e.preventDefault(); setState("dragging"); };
  const onDragLeave = () => setState("idle");

  const styles = {
    zone: {
      border: `1px solid ${state === "dragging" ? "var(--accent)" : state === "error" ? "var(--red)" : state === "done" ? "var(--accent)" : "var(--border-bright)"}`,
      borderRadius: "var(--radius-lg)",
      padding: "48px 32px",
      textAlign: "center",
      cursor: "pointer",
      background: state === "dragging" ? "var(--accent-dim)" : state === "done" ? "var(--accent-dim)" : "var(--bg-surface)",
      transition: "all var(--transition)",
      position: "relative",
      overflow: "hidden",
    },
    label: {
      fontSize: "11px",
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      fontFamily: "var(--font-mono)",
      marginBottom: "12px",
    },
    heading: {
      fontSize: "16px",
      fontWeight: 500,
      color: state === "done" ? "var(--accent)" : "var(--text-primary)",
      marginBottom: "8px",
    },
    sub: {
      fontSize: "12px",
      color: "var(--text-secondary)",
      fontFamily: "var(--font-mono)",
    },
    progress: {
      height: "2px",
      background: "var(--border)",
      borderRadius: "99px",
      marginTop: "20px",
      overflow: "hidden",
    },
    bar: {
      height: "100%",
      background: "var(--accent)",
      width: `${progress}%`,
      transition: "width 0.5s ease",
      borderRadius: "99px",
    },
  };

  return (
    <div
      style={styles.zone}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => state !== "uploading" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {/* Icon */}
      <div style={{ fontSize: "32px", marginBottom: "16px" }}>
        {state === "uploading" ? "⚙️" : state === "done" ? "✅" : state === "error" ? "❌" : "📄"}
      </div>

      <div style={styles.label}>
        {state === "uploading" ? "PROCESSING" : state === "done" ? "INDEXED" : "DOCUMENT INGESTION"}
      </div>

      <div style={styles.heading}>
        {state === "idle" && "Drop your PDF here"}
        {state === "dragging" && "Release to upload"}
        {state === "uploading" && "Embedding & indexing…"}
        {state === "done" && info?.filename}
        {state === "error" && "Upload failed"}
      </div>

      <div style={styles.sub}>
        {state === "idle" && "or click to browse — max 20 MB"}
        {state === "dragging" && "PDF files only"}
        {state === "uploading" && "Chunking → embedding → Pinecone upsert"}
        {state === "done" && `${info?.pageCount} pages · ${info?.chunkCount} chunks indexed`}
        {state === "error" && error}
      </div>

      {state === "uploading" && (
        <div style={styles.progress}><div style={styles.bar} /></div>
      )}
    </div>
  );
}

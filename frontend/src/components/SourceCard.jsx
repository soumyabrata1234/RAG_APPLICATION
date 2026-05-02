import { useState } from "react";

export function SourceCard({ sources }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources?.length) return null;

  return (
    <div style={{
      marginTop: "12px",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
      fontFamily: "var(--font-mono)",
      fontSize: "11px",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "8px 12px",
          background: "var(--bg-elevated)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "var(--text-muted)",
          fontSize: "11px",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.1em",
          textAlign: "left",
        }}
      >
        <span style={{ color: "var(--accent)", fontSize: "9px" }}>▶</span>
        <span>{sources.length} SOURCE CHUNK{sources.length !== 1 ? "S" : ""} RETRIEVED</span>
        <span style={{ marginLeft: "auto" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px", background: "var(--bg-surface)" }}>
          {sources.map((src, i) => (
            <div
              key={i}
              style={{
                padding: "8px 10px",
                background: "var(--bg-elevated)",
                borderRadius: "var(--radius-sm)",
                borderLeft: "2px solid var(--accent-dim)",
              }}
            >
              <div style={{ color: "var(--text-muted)", marginBottom: "4px" }}>
                PAGE {src.metadata.page} · CHUNK #{src.metadata.chunkIndex}
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {src.pageContent}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

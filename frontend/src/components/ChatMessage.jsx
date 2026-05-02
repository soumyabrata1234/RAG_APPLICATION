import ReactMarkdown from "react-markdown";
import { SourceCard } from "./SourceCard.jsx";

const CURSOR = (
  <span
    style={{
      display: "inline-block",
      width: "8px",
      height: "14px",
      background: "var(--accent)",
      marginLeft: "2px",
      verticalAlign: "text-bottom",
      animation: "blink 1s step-end infinite",
    }}
  />
);

export function ChatMessage({ message }) {
  const { role, content, sources, streaming } = message;
  const isUser = role === "user";

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: isUser ? "flex-end" : "flex-start",
    animation: "fadeIn 0.2s ease",
    maxWidth: "100%",
  };

  const bubbleStyle = {
    maxWidth: "85%",
    padding: "12px 16px",
    borderRadius: "var(--radius-md)",
    background: isUser ? "var(--bg-elevated)" : "var(--bg-surface)",
    border: `1px solid ${isUser ? "var(--border-bright)" : "var(--border)"}`,
    borderLeft: isUser ? undefined : "2px solid var(--accent)",
    color: "var(--text-primary)",
    fontSize: "13px",
    lineHeight: 1.7,
  };

  const labelStyle = {
    fontSize: "10px",
    letterSpacing: "0.12em",
    fontFamily: "var(--font-mono)",
    color: isUser ? "var(--text-muted)" : "var(--accent)",
    marginBottom: "6px",
    paddingLeft: isUser ? 0 : "2px",
    paddingRight: isUser ? "2px" : 0,
    textAlign: isUser ? "right" : "left",
  };

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>{isUser ? "YOU" : "DOCQUERY"}</div>
      <div style={{ maxWidth: "85%", width: "100%" }}>
        <div style={bubbleStyle}>
          {isUser ? (
            <span>{content}</span>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={{ margin: "0 0 8px" }}>{children}</p>,
                ul: ({ children }) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }}>{children}</ul>,
                li: ({ children }) => <li style={{ marginBottom: "4px" }}>{children}</li>,
                code: ({ inline, children }) =>
                  inline ? (
                    <code style={{
                      fontFamily: "var(--font-mono)",
                      background: "var(--bg-elevated)",
                      padding: "1px 5px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      color: "var(--accent)",
                    }}>
                      {children}
                    </code>
                  ) : (
                    <code style={{
                      display: "block",
                      fontFamily: "var(--font-mono)",
                      background: "var(--bg-elevated)",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      overflowX: "auto",
                      margin: "8px 0",
                    }}>
                      {children}
                    </code>
                  ),
                strong: ({ children }) => <strong style={{ color: "var(--accent)", fontWeight: 500 }}>{children}</strong>,
                blockquote: ({ children }) => (
                  <blockquote style={{
                    borderLeft: "2px solid var(--accent-dim)",
                    paddingLeft: "12px",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    margin: "8px 0",
                  }}>
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content || ""}
            </ReactMarkdown>
          )}
          {streaming && CURSOR}
        </div>

        {!isUser && sources && <SourceCard sources={sources} />}
      </div>
    </div>
  );
}

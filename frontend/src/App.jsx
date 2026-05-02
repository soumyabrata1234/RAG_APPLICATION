import React, { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import {
  Upload, FileText, Trash2, Send, X, ChevronRight,
  Cpu, Database, Zap, AlertCircle, CheckCircle2,
  MessageSquare, RotateCcw, File, Loader2, Terminal
} from "lucide-react";
import { api } from "./api.js";
import "./App.css";

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatTime = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// --- Components ---

const StatusBar = ({ status }) => (
  <div className="status-bar">
    <span className="status-dot" data-status={status.connected ? "ok" : "err"} />
    <span className="status-text font-mono">
      {status.connected ? "API connected" : "API offline"}
    </span>
    <span className="status-sep">|</span>
    <span className="status-text font-mono">
      <Cpu size={10} style={{ display: "inline", marginRight: 4 }} />
      gpt-4o-mini
    </span>
    <span className="status-sep">|</span>
    <span className="status-text font-mono">
      <Database size={10} style={{ display: "inline", marginRight: 4 }} />
      pinecone
    </span>
  </div>
);

const DropZone = ({ onFile, uploading, progress }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") onFile(file);
  };

  return (
    <div
      className={`dropzone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept=".pdf" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      {uploading ? (
        <div className="dz-uploading">
          <div className="dz-progress-bar"><div className="dz-progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="font-mono dz-pct">{progress}%</span>
          <span className="dz-label">processing &amp; embedding...</span>
        </div>
      ) : (
        <>
          <Upload size={20} className="dz-icon" />
          <span className="dz-main">Drop PDF here or click to browse</span>
          <span className="dz-sub font-mono">max 25 MB · text-based PDFs only</span>
        </>
      )}
    </div>
  );
};

const DocumentCard = ({ doc, selected, onSelect, onDelete }) => (
  <div className={`doc-card ${selected ? "selected" : ""}`} onClick={() => onSelect(doc)}>
    <div className="doc-card-icon">
      <FileText size={16} />
    </div>
    <div className="doc-card-body">
      <p className="doc-name">{doc.name}</p>
      <p className="doc-meta font-mono">
        {doc.pages}p · {doc.chunks} chunks · {formatFileSize(doc.size)}
      </p>
      <p className="doc-time font-mono">{formatTime(doc.uploadedAt)} · {doc.processingTime}</p>
    </div>
    <button
      className="doc-delete"
      onClick={(e) => { e.stopPropagation(); onDelete(doc.id); }}
      title="Delete document"
    >
      <Trash2 size={13} />
    </button>
    {selected && <div className="doc-active-bar" />}
  </div>
);

const SourceChip = ({ source }) => (
  <span className="source-chip font-mono" title={source.content}>
    <File size={10} />
    {source.metadata?.source?.replace(/\.pdf$/i, "") || "source"}
    {source.metadata?.pages && ` · ${source.metadata.pages}p`}
  </span>
);

const ChatMessage = ({ msg }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`chat-msg ${isUser ? "user" : "assistant"}`}>
      <div className="msg-role font-mono">
        {isUser ? (
          <><ChevronRight size={12} /> you</>
        ) : (
          <><Terminal size={12} /> docmind</>
        )}
        <span className="msg-time">{msg.time}</span>
      </div>
      <div
        className="msg-content"
        dangerouslySetInnerHTML={{ __html: isUser ? msg.content.replace(/</g, "&lt;") : marked.parse(msg.content) }}
      />
      {msg.sources?.length > 0 && (
        <div className="msg-sources">
          {msg.sources.map((s, i) => <SourceChip key={i} source={s} />)}
        </div>
      )}
    </div>
  );
};

const WelcomePlaceholder = ({ docName }) => (
  <div className="welcome">
    <div className="welcome-icon"><Zap size={28} /></div>
    <h2 className="welcome-title font-mono">Ready to query</h2>
    <p className="welcome-sub">{docName}</p>
    <div className="welcome-hints">
      {["Summarize this document", "What are the key findings?", "List all mentioned dates", "Explain the main concept"].map((h) => (
        <span key={h} className="hint-pill font-mono">{h}</span>
      ))}
    </div>
  </div>
);

const Toast = ({ toast, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type}`}>
      {toast.type === "error" ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
      <span>{toast.message}</span>
      <button onClick={onClose}><X size={12} /></button>
    </div>
  );
};

// --- Main App ---
export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState({ connected: false });
  const [toast, setToast] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const showToast = (message, type = "success") => setToast({ message, type });

  // Health check
  useEffect(() => {
    api.health().then(() => setStatus({ connected: true })).catch(() => setStatus({ connected: false }));
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  const handleUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const { document: doc } = await api.uploadDocument(file, setUploadProgress);
      setDocuments((prev) => [doc, ...prev]);
      setSelectedDoc(doc);
      setMessages([]);
      setConversationId(null);
      showToast(`"${doc.name}" indexed successfully`);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (selectedDoc?.id === id) {
        setSelectedDoc(null);
        setMessages([]);
        setConversationId(null);
      }
      showToast("Document removed");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSelectDoc = (doc) => {
    setSelectedDoc(doc);
    setMessages([]);
    setConversationId(null);
  };

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || !selectedDoc || loading || streaming) return;
    setInput("");

    const userMsg = { role: "user", content: q, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    let streamedContent = "";
    const assistantMsg = { role: "assistant", content: "", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), sources: [] };
    setMessages((prev) => [...prev, assistantMsg]);

    api.chatStream(
      q,
      selectedDoc.id,
      conversationId,
      (token) => {
        streamedContent += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...assistantMsg, content: streamedContent };
          return next;
        });
      },
      ({ sourceDocuments, conversationId: cid }) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...assistantMsg, content: streamedContent, sources: sourceDocuments || [] };
          return next;
        });
        setConversationId(cid);
        setStreaming(false);
      },
      (err) => {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...assistantMsg, content: `Error: ${err.message}`, error: true };
          return next;
        });
        setStreaming(false);
        showToast(err.message, "error");
      }
    );
  }, [input, selectedDoc, loading, streaming, conversationId]);

  const handleClearChat = async () => {
    if (conversationId) await api.clearHistory(conversationId).catch(() => {});
    setMessages([]);
    setConversationId(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon font-mono">&gt;_</span>
            <span className="logo-text font-mono">DocMind</span>
          </div>
          <p className="logo-sub font-mono">RAG PDF Assistant</p>
        </div>

        <div className="sidebar-section">
          <DropZone onFile={handleUpload} uploading={uploading} progress={uploadProgress} />
        </div>

        <div className="sidebar-section sidebar-docs">
          <div className="section-label font-mono">
            <Database size={11} />
            {documents.length > 0 ? `${documents.length} document${documents.length !== 1 ? "s" : ""}` : "no documents"}
          </div>
          <div className="doc-list">
            {documents.length === 0 ? (
              <p className="empty-docs font-mono">Upload a PDF to get started</p>
            ) : (
              documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  selected={selectedDoc?.id === doc.id}
                  onSelect={handleSelectDoc}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <StatusBar status={status} />
        </div>
      </aside>

      {/* Main chat area */}
      <main className="main">
        {!selectedDoc ? (
          <div className="no-doc">
            <MessageSquare size={40} className="no-doc-icon" />
            <h2 className="no-doc-title font-mono">No document selected</h2>
            <p className="no-doc-sub">Upload a PDF and select it to start chatting</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-doc-info">
                <FileText size={14} />
                <span className="font-mono">{selectedDoc.name}</span>
                <span className="chat-doc-meta font-mono">{selectedDoc.pages}p · {selectedDoc.chunks} chunks</span>
              </div>
              {messages.length > 0 && (
                <button className="btn-clear font-mono" onClick={handleClearChat} title="Clear conversation">
                  <RotateCcw size={12} /> clear
                </button>
              )}
            </div>

            <div className="chat-messages">
              {messages.length === 0 ? (
                <WelcomePlaceholder docName={selectedDoc.name} />
              ) : (
                messages.map((msg, i) => <ChatMessage key={i} msg={msg} />)
              )}
              {streaming && messages[messages.length - 1]?.content === "" && (
                <div className="typing-indicator">
                  <span /><span /><span />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="input-wrapper">
                <textarea
                  ref={textareaRef}
                  className="chat-input font-mono"
                  placeholder="Ask anything about the document... (Enter to send)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading || streaming}
                  rows={1}
                />
                <button
                  className="send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || loading || streaming}
                >
                  {streaming ? <Loader2 size={16} className="spinning" /> : <Send size={16} />}
                </button>
              </div>
              <p className="input-hint font-mono">Shift+Enter for newline · streaming enabled</p>
            </div>
          </>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

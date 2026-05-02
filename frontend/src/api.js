const BASE = "/api";

export const api = {
  /**
   * Upload a PDF file
   * @param {File} file
   * @param {Function} onProgress
   */
  uploadDocument: async (file, onProgress) => {
    const formData = new FormData();
    formData.append("pdf", file);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${BASE}/documents/upload`);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(JSON.parse(xhr.responseText)?.error || "Upload failed"));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
      xhr.send(formData);
    });
  },

  /**
   * List all uploaded documents
   */
  listDocuments: async () => {
    const res = await fetch(`${BASE}/documents`);
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  },

  /**
   * Delete a document
   */
  deleteDocument: async (id) => {
    const res = await fetch(`${BASE}/documents/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete document");
    return res.json();
  },

  /**
   * Send a chat message (non-streaming)
   */
  chat: async (question, documentId, conversationId) => {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, documentId, conversationId, stream: false }),
    });
    if (!res.ok) throw new Error((await res.json())?.error || "Chat request failed");
    return res.json();
  },

  /**
   * Stream a chat response
   * @param {string} question
   * @param {string} documentId
   * @param {string} conversationId
   * @param {Function} onToken - called with each streamed token
   * @param {Function} onDone - called when stream ends
   * @param {Function} onError
   */
  chatStream: (question, documentId, conversationId, onToken, onDone, onError) => {
    fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, documentId, conversationId, stream: true }),
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json();
        onError(new Error(err?.error || "Streaming failed"));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "token") onToken(event.content);
            if (event.type === "done") onDone(event);
            if (event.type === "error") onError(new Error(event.message));
          } catch (_) {}
        }
      }
    }).catch(onError);
  },

  /**
   * Clear conversation history
   */
  clearHistory: async (conversationId) => {
    const res = await fetch(`${BASE}/chat/history/${conversationId}`, { method: "DELETE" });
    return res.json();
  },

  /**
   * Health check
   */
  health: async () => {
    const res = await fetch(`${BASE.replace("/api", "")}/health`);
    return res.json();
  },
};

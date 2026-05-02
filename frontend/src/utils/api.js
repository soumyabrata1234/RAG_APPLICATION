const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data.data;
}

/**
 * Upload a PDF file. Returns { documentId, filename, chunkCount, pageCount }.
 */
export async function uploadPDF(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/documents/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");
  return data.data;
}

/**
 * Delete a document from the vector store.
 */
export async function deleteDocument(documentId) {
  return request(`/documents/${documentId}`, { method: "DELETE" });
}

/**
 * Query a document (non-streaming). Returns { answer, sources }.
 */
export async function queryDocument(documentId, question) {
  return request("/chat/query", {
    method: "POST",
    body: JSON.stringify({ documentId, question }),
  });
}

/**
 * Stream a query using Server-Sent Events.
 * Calls onToken(token), onSources(sources), onDone() as events arrive.
 *
 * @returns {() => void} abort function
 */
export function streamQuery(documentId, question, { onToken, onSources, onDone, onError }) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, question }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Stream failed" }));
        throw new Error(err.error || "Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (eventType === "token")   onToken?.(payload.token);
              if (eventType === "sources") onSources?.(payload);
              if (eventType === "done")    onDone?.();
            } catch {}
            eventType = null;
          }
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err);
    }
  })();

  return () => controller.abort();
}

/**
 * Check server health.
 */
export async function checkHealth() {
  return request("/health");
}

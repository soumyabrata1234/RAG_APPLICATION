# DocMind — RAG PDF Chatbot

A production-grade **Retrieval-Augmented Generation (RAG)** application that lets you upload any PDF and have an intelligent conversation with it — powered by **LangChain.js**, **Pinecone**, and **Google Gemini**.

```
┌─────────────────────────────────────────────────────────┐
│                    Architecture                         │
│                                                         │
│  PDF Upload → pdf-parse → RecursiveTextSplitter         │
│      → Gemini Embeddings → Pinecone (namespace/doc)     │
│                                                         │
│  Question → History-Aware Retriever → Top-K Chunks      │
│      → Gemini 2.5 Flash → Streamed Answer + Sources     │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + JetBrains Mono (terminal UI) |
| Backend | Node.js + Express (ESM) |
| RAG Framework | LangChain.js (`langchain`, `@langchain/core`, `@langchain/google-genai`) |
| Vector Store | Pinecone (serverless, cosine similarity, 3072-dim) |
| Embeddings | `gemini-embedding-2` |
| LLM | `gemini-2.5-flash` with streaming (SSE) |
| PDF Parsing | `pdf-parse` + `@langchain/community` PDFLoader |
| Chunking | `RecursiveCharacterTextSplitter` (1000 chars / 200 overlap) |
| Validation | Zod (env + request schemas) |
| Logging | Winston |

## Features

- **Streaming Responses** — SSE-based token streaming so answers appear word by word
- **Conversation Memory** — history-aware retriever reformulates questions based on prior context
- **Document Isolation** — each PDF stored in its own Pinecone namespace (no cross-contamination)
- **Source Attribution** — every answer shows which document chunks it was derived from
- **Multi-document** — upload multiple PDFs and switch between them at will
- **Auto Index Creation** — Pinecone index created automatically on first run
- **Zod validation** — all environment variables and API requests validated at startup
- **Rate limiting** — configurable per-window request caps

## Project Structure

```
rag-pdf-chatbot/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js          # Zod-validated env config
│   │   │   ├── llm.js          # OpenAI embeddings + chat model singletons
│   │   │   └── pinecone.js     # Pinecone client + auto index creation
│   │   ├── services/
│   │   │   ├── ragService.js   # History-aware RAG chain (LangChain LCEL)
│   │   │   ├── embeddingService.js  # Embed + store + retrieve
│   │   │   ├── pdfService.js   # PDF parsing + text cleaning
│   │   │   └── pineconeService.js   # Namespace management
│   │   ├── routes/
│   │   │   ├── documents.js    # POST /upload, GET /, DELETE /:id
│   │   │   └── chat.js         # POST /chat (stream + non-stream), history CRUD
│   │   ├── middleware/
│   │   │   └── errorHandler.js # Global Express error handler
│   │   ├── utils/
│   │   │   └── logger.js       # Winston logger
│   │   └── index.js            # Express app entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main app (upload, doc list, chat UI)
│   │   ├── App.css             # Terminal dark theme
│   │   └── api.js              # API client (XHR upload + SSE streaming)
│   ├── index.html
│   └── vite.config.js          # Proxy /api → backend:3001
└── README.md
```

## 🐳 Run with Docker

The fastest way to get the application up and running is by using the pre-built Docker image. The container statically serves the frontend and runs the backend API on a single port.

```bash
docker run -p 3001:3001 \
  -e GOOGLE_API_KEY="your-gemini-key" \
  -e PINECONE_API_KEY="your-pinecone-key" \
  -e PINECONE_INDEX_NAME="soumya" \
  soumyabrata80/rag_application:latest
```

After the container starts, simply navigate to `http://localhost:3001` in your browser.

---

## 🛠️ Local Development

### Prerequisites

- Node.js 18+
- [Google Gemini API key](https://aistudio.google.com/app/apikey)
- [Pinecone account](https://www.pinecone.io/) (free tier works)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/rag-pdf-chatbot.git
cd rag-pdf-chatbot

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=pdf-rag-index
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
```

### 3. Run

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

### 4. First Use

1. Drop a PDF into the sidebar dropzone
2. Wait for embedding (progress bar shows %)
3. Click the document to select it
4. Ask questions in the chat!

## RAG Pipeline Details

### Ingestion

```
PDF Buffer
  → pdf-parse (text extraction + metadata)
  → text cleaning (whitespace, artifacts)
  → RecursiveCharacterTextSplitter
      chunkSize: 1000, chunkOverlap: 200
  → OpenAI text-embedding-ada-002
  → PineconeStore.fromDocuments()
      namespace: <documentId>  ← isolated per PDF
```

### Retrieval + Generation

```
User Question + Chat History
  → historyAwareRetriever
      (reformulates question using prior context)
  → Pinecone similarity search (top 5 chunks)
  → StuffDocumentsChain
      (injects chunks into system prompt)
  → gpt-4o-mini (streaming)
  → SSE token stream → React UI
```

## API Endpoints

### Documents

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/documents/upload` | Upload & embed PDF |
| `GET`  | `/api/documents` | List all documents |
| `GET`  | `/api/documents/:id` | Get document details |
| `DELETE` | `/api/documents/:id` | Delete + remove from Pinecone |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/chat` | Query document (stream or non-stream) |
| `GET`  | `/api/chat/history/:id` | Get conversation history |
| `DELETE` | `/api/chat/history/:id` | Clear conversation |

### Request Body (POST /api/chat)

```json
{
  "question": "What are the key findings?",
  "documentId": "uuid-v4",
  "conversationId": "uuid-v4",
  "stream": true
}
```

## Production Considerations

- Replace in-memory `documentRegistry` and `conversationHistory` with Redis or PostgreSQL
- Add authentication (JWT middleware) before all routes
- Use `multer-s3` to store PDFs in S3 instead of memory
- Configure `ALLOWED_ORIGINS` to your production domain
- Set `NODE_ENV=production` to disable debug logs
- Add a queue (BullMQ) for large PDF ingestion jobs

## License

MIT

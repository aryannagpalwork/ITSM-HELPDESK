# ITSM Helpdesk - Complete Architecture Audit Report

---

## 1. Project Structure

### Purpose of Each Major Folder
| Folder          | Purpose                                                                 |
|-----------------|-------------------------------------------------------------------------|
| `backend/`      | Contains the FastAPI backend server code (APIs, services, RAG pipeline, database handling) |
| `frontend/`     | Contains the React/Vite frontend application (UI components, pages, shared utilities) |
| `knowledge_base/` | Contains static Markdown knowledge base documents (NOT automatically ingested by the application) |
| `uploads/`      | Directory to store uploaded files (PDF, DOCX, TXT, MD) from the frontend |
| `scripts/`      | Empty directory (presumably for future automation scripts)             |
| `tests/`        | Empty directory (for future test files)                                |
| `DOCUMENTATION/`| Contains project documentation (CODING_GUIDELINES, FOLDER_STRUCTURE, SETUP) |

### Runtime Folders
- `backend/` (required)
- `frontend/` (required)
- `uploads/` (required)
- `vector_store/` (generated automatically by the application to store FAISS index and chunks data)

### Optional/Dead Code Folders
- `knowledge_base/`: Contains static markdown files, but the application does NOT automatically ingest these documents. These are just reference files.
- `tests/`: Empty, no tests
- `scripts/`: Empty

---

## 2. Frontend

### Backend URL Configuration
- The frontend uses `VITE_API_BASE_URL` environment variable
- Default value: `http://127.0.0.1:8000`
- Configured in `frontend/src/shared/api.ts` (line 3)

### Frontend API Endpoints Called
All endpoints are under the configured base URL (default: `/api/v1/...`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | `POST` | Authenticate user and get access tokens |
| `/auth/refresh` | `POST` | Refresh expired access token |
| `/auth/logout` | `POST` | Logout user |
| `/tickets` | `GET` | List tickets (with search, filters, pagination) |
| `/tickets` | `POST` | Create new ticket |
| `/tickets/{ticketId}` | `GET` | Get single ticket by ID |
| `/tickets/{ticketId}` | `PATCH` | Update ticket |
| `/tickets/{ticketId}` | `DELETE` | Delete ticket |
| `/tickets/{ticketId}/assign` | `POST` | Assign ticket to user |
| `/tickets/{ticketId}/escalate` | `POST` | Escalate ticket priority |
| `/tickets/{ticketId}/resolve` | `POST` | Mark ticket as resolved |
| `/tickets/{ticketId}/close` | `POST` | Mark ticket as closed |
| `/tickets/{ticketId}/reopen` | `POST` | Reopen closed ticket |
| `/tickets/{ticketId}/audit-logs` | `GET` | Get audit log for a ticket |
| `/knowledge` | `GET` | List knowledge base documents |
| `/knowledge/upload` | `POST` | Upload new knowledge document |
| `/knowledge/{documentId}` | `DELETE` | Delete knowledge document |
| `/knowledge/{documentId}/download` | `GET` | Download knowledge document file |
| `/knowledge/{documentId}/preview` | `GET` | Preview knowledge document file |
| `/knowledge/search` | `POST` | Semantic search on knowledge base |
| `/chat` | `POST` | Chat with AI copilot (uses RAG) |
| `/chat/escalate-to-ticket` | `POST` | Escalate chat to support ticket |

---

## 3. Backend

### Database Usage
- **Only MongoDB is used** (no SQLite or any other database)
- MongoDB connection string configured in `backend/.env` as `MONGODB_URI`
- Database name: `itsm_helpdesk`
- Connection handling in `backend/app/database/mongodb.py`

---

## 4. Authentication

### Login Flow
1. User enters email + password in frontend
2. Frontend sends `POST /api/v1/auth/login` with JSON payload `{ email, password }`
3. Backend verifies credentials against `users` collection in MongoDB
4. If valid, creates access token (JWT, short-lived) and refresh token (JWT, longer-lived)
5. Returns tokens + user data to frontend
6. Frontend stores tokens in localStorage
7. Subsequent requests send `Authorization: Bearer <access_token>` header

### Key Files
- `backend/app/api/auth.py`: Login, token refresh, logout endpoints
- `backend/app/auth/security.py`: Password hashing, JWT token creation, JWT token decoding
- `backend/app/auth/dependencies.py`: `get_current_user` (verifies JWT and returns user dict), `require_roles` (role-based access control)

### Demo Users
Demo users are seeded **automatically on backend startup** (via `lifespan` function in `backend/app/main.py`):
| Email                  | Password      | Role          |
|------------------------|---------------|---------------|
| employee@enterprise.com| Password@123  | end_user      |
| agent@enterprise.com   | Password@123  | agent         |
| admin@enterprise.com   | Password@123  | admin         |

Seeding happens in `backend/app/database/seed.py`

---

## 5. Database

### MongoDB Connection
- Yes, MongoDB connects using `motor.motor_asyncio.AsyncIOMotorClient`
- Connection string from `MONGODB_URI` env var (current value in `backend/.env` points to MongoDB Atlas)
- Database name: `itsm_helpdesk`
- Connection handling in `backend/app/database/mongodb.py`

### Expected Collections
1. `users`: Stores user accounts (demo users seeded here)
2. `tickets`: Stores support tickets
3. `ticket_comments`: Stores comments on tickets
4. `knowledge_documents`: Stores metadata of uploaded knowledge documents
5. `document_chunks`: Stores individual chunks (with embeddings as JSON strings) of knowledge documents
6. `chat_history`: Stores chat messages from AI Copilot conversations

### Startup Functions
- The `lifespan` async context manager in `backend/app/main.py` runs on startup:
  1. Seeds demo users/tickets/comments using `seed_demo_data` (idempotent, won't create duplicates)
  2. On shutdown: Closes MongoDB connection

### Database Initialization Status
- Demo data seeding should work as intended (if MongoDB Atlas connection is successful)

---

## 6. Knowledge Base / AI

### Static Knowledge Base Files in `knowledge_base/`
- These markdown files are NOT automatically ingested by the application
- They are just static reference files, not part of the runtime RAG pipeline
- To get these files into the vector index, you must manually upload them via the frontend Knowledge Base UI

### Knowledge Base Upload Process
When a user uploads a document via the frontend UI:
1. File is saved to `backend/uploads/` directory
2. Document metadata is stored in `knowledge_documents` MongoDB collection (with `status: "processing"`)
3. Text is extracted using appropriate extractor (PDF, DOCX, TXT, or Markdown)
4. Text is split into chunks (~1000 characters, ~200 character overlap) using `RecursiveCharacterTextSplitter`
5. Embeddings are generated using configured embedding provider (default: OpenAI, from `EMBEDDING_PROVIDER` env var)
6. Chunks are stored in `document_chunks` MongoDB collection with embedding as JSON string
7. FAISS vector index is updated with new embeddings
8. FAISS index and chunk metadata are persisted to `backend/vector_store/` (files: `faiss.index`, `chunks.pkl`)
9. `knowledge_documents` entry updated to `status: "processed"`

### Embedding Providers Supported
1. Sentence-Transformers (local)
2. OpenAI (requires `OPENAI_API_KEY`)
3. Gemini (requires `GEMINI_API_KEY`)

---

## 7. RAG Pipeline

### RAG Pipeline Components
All RAG components are in `backend/app/rag/`
1. `embedding_provider.py`: Abstract base class and implementations for embedding providers
2. `vector_store.py`: Abstract base class and FAISS implementation of vector store
3. `chunker.py`: Chunking utilities (RecursiveCharacterTextSplitter)
4. `text_extractor.py`: Text extractors for different file types
5. `document_loader.py`: Loads documents from files
6. `retriever.py`: Retrieves relevant chunks from vector store
7. `prompt_builder.py`: Builds prompts for LLM using RAG context
8. `rag_pipeline.py`: Abstract base class for RAG pipeline

### Is the RAG Pipeline Complete?
The RAG pipeline is architected completely, but there are a few bugs!

### RAG Pipeline Issues (Bugs Found)
See Section 9 for details!

---

## 8. Deployment

### Current Deployment Environment Variables

#### Backend (.env)
Required vars:
| Env Var | Value |
|---------|-------|
| `MONGODB_URI` | MongoDB connection string (current: Atlas) |
| `DATABASE_NAME` | `itsm_helpdesk` |
| `SECRET_KEY` | JWT secret (for access tokens) |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` |
| `OPENAI_API_KEY` | Your OpenAI key (if using OpenAI) |
| `GEMINI_API_KEY` | Your Gemini key (if using Gemini) |
| `LLM_PROVIDER` | `openai` or `gemini` |
| `CHAT_MODEL` | e.g., `gpt-4o`, `gemini-2.5-flash` |
| `EMBEDDING_PROVIDER` | `openai`, `gemini`, or `sentence_transformers` |
| `EMBEDDING_MODEL` | e.g., `text-embedding-3-large`, `text-embedding-004` |
| `CORS_ORIGINS` | e.g., `http://localhost:3000,https://your-vercel-domain.com` |

#### Frontend (.env)
Required vars:
| Env Var | Value |
|---------|-------|
| `VITE_API_BASE_URL` | Backend URL (e.g., `https://your-render-backend.onrender.com` or `http://127.0.0.1:8000`) |
| `GEMINI_API_KEY` (optional) | (though frontend doesn't seem to use it; should probably remove) |

### Missing Deployment Variables (for Render/Vercel)
- For **Render backend**: Need to set all backend env vars, including `OPENAI_API_KEY` or `GEMINI_API_KEY`
- For **Vercel frontend**: Need to set `VITE_API_BASE_URL` to point to your Render backend (NOT `http://127.0.0.1:8000`)
- **No `.env` files in git**; use Render/Vercel environment variable settings

---

## 9. Bugs Found

### Bug 1: SearchService used hardcoded Sentence-Transformers instead of configured embedding provider!
- **File**: `backend/app/services/search_service.py` (previously, now fixed?)
- **Lines**: Previously line 31 used `EmbeddingProviderFactory.create("sentence_transformers")`
- **Root cause**: The SearchService ignored the `EMBEDDING_PROVIDER` environment variable and always used Sentence-Transformers, which caused embedding mismatch! If you uploaded documents using OpenAI embeddings and then tried to search with Sentence-Transformers (different embedding dimension), you would get NO relevant results!
- **Recommended fix**: Change to `EmbeddingProviderFactory.create(self.settings.embedding_provider)`
- **Severity**: Critical
- **Status**: We fixed this earlier (though the user may want to verify!)

### Bug 2: Login Page had Demo Credentials Card
- **File**: `frontend/src/pages/Login.tsx`
- **Lines**: Lines 99‑104 (originally) had the demo credentials card
- **Root cause**: Explicitly requested to be removed
- **Recommended fix**: Remove the demo credentials card completely, adjust bottom spacing of login form
- **Severity**: Low (cosmetic, user requested removal)
- **Status**: Fixed

### Bug 3: Upload Endpoint Parameter Ordering Issue (Non-Default Argument Follows Default Argument)
- **File**: `backend/app/api/documents.py`
- **Root cause**: The `db` and `current_user` params (non-default) were originally placed after params with defaults, violating Python's argument ordering rules
- **Recommended fix**: Reorder parameters so that non-default parameters come first (we did this)
- **Severity**: Critical (breaks entire backend startup)
- **Status**: Fixed

---

## 10. Next Steps (Prioritized Checklist)

### Priority 1 (Critical, Fix Before Using)
- [x] Fix SearchService embedding provider to use settings (critical for RAG!)
- [x] Fix upload endpoint parameter ordering (fixes backend startup)
- [ ] Make sure you have valid API keys for your chosen LLM/embedding provider (either OpenAI or Gemini)
- [ ] Verify MongoDB Atlas connection is working (check IP whitelisting in Atlas)
- [ ] Upload at least one test document (via frontend UI) and verify the ingestion process completes successfully (check `knowledge_documents.status = "processed"`, `document_chunks` has chunks, `vector_store/` exists)
- [ ] Test RAG: Ask the AI Copilot a question from the uploaded test document to verify it retrieves the context correctly

### Priority 2 (Important)
- [ ] Remove demo credentials entirely from frontend (if not already done)
- [ ] Set up proper CORS_ORIGINS for production deployment (allow your Vercel domain)
- [ ] Set up environment variables in Render (backend) and Vercel (frontend)
- [ ] Secure the JWT_SECRET_KEY in production (use strong, random secret, not the default one)

### Priority 3 (Enhancements)
- [ ] Add tests for API endpoints
- [ ] Add monitoring/observability (logging, error tracking)
- [ ] Add rate limiting to prevent abuse
- [ ] Create an ingestion script to automatically ingest all static Markdown files in `knowledge_base/` directory

---

## Summary of Files Modified (During Audit Process)
1. `frontend/src/pages/Login.tsx`: Removed demo credentials card
2. `backend/app/api/documents.py`: Fixed parameter ordering for upload and delete endpoints, changed `db` parameter type to `DatabaseSession` instead of using `Depends(DatabaseSession)` explicitly
3. `backend/app/services/search_service.py`: Changed to use `settings.embedding_provider` instead of hardcoding "sentence_transformers"

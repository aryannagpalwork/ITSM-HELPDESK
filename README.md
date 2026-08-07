# Enterprise ITSM Helpdesk AI Copilot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?logo=vite)](https://vitejs.dev/)

## Project Overview

This repository contains a production-ready enterprise IT service management (ITSM) helpdesk AI copilot application. It is built as a full-stack monorepo with:
- **Frontend**: React + TypeScript + Vite SPA with modern UI
- **Backend**: FastAPI + Motor (async MongoDB driver)
- **AI**: Google Gemini + RAG for intelligent ticket analysis & chat
- **Storage**: MongoDB for persistence, FAISS for vector search
- **Deployment**: Render backend + Vercel frontend

## What is Included
- **`frontend/`**: React + TypeScript SPA with real API integration and fallback mock data
- **`backend/`**: FastAPI backend with JWT auth, MongoDB persistence, RAG pipeline, and Gemini integration
- **`knowledge_base/`**: Complete, realistic enterprise knowledge base for fictional company **EnterpriseTech Solutions**
- **`DOCUMENTATION/`**: Setup, coding standards, and folder structure guidance
- Root directory: Comprehensive architecture, API reference, and roadmap docs

## Features Implemented

### Core Platform
- ✅ JWT-based Authentication with refresh tokens
- ✅ Multi-user Registration & Login
- ✅ Role-based Access Control (Employee / Agent / Admin roles)
- ✅ Audit logging for all ticket state changes
- ✅ MongoDB persistence for tickets, users, comments, documents
- ✅ Real-time AI Chat Copilot with RAG
- ✅ Knowledge Base (KB) with document ingestion (PDF, DOCX, TXT, Markdown)
- ✅ RAG-powered Semantic Search over KB
- ✅ Incident creation workflow
- ✅ AI Ticket Analysis (category, priority, department, tags, confidence, possible root cause, suggested resolution, estimated SLA)
- ✅ Smart Ticket Routing (auto-assign team based on AI category)
- ✅ User Dashboard (Employee/Agent/Admin-specific views)
- ✅ Featured Knowledge Articles
- ✅ Quick Queries
- ✅ Ticket Dashboard
- ✅ Ticket Details Page

### Recent Alert System Updates
- Fixed duplicate auto-detected alert generation in the backend.
- Added a dedicated **Agent Alert Center** page for agent-specific alerts.
- Removed alert notifications from the admin bell and kept ticket notifications for agents only.
- Updated agent-created ticket notification text to say: "Ticket has been created."

#### Files Added / Updated
- Added `frontend/src/pages/AgentAlertManagement.tsx`
- Added `backend/tests/test_ticket_assignment_notifications.py`
- Updated `backend/app/services/anomaly_scheduler.py`
- Updated `backend/tests/test_anomaly_scheduler.py`
- Updated `frontend/src/modules/agent/Sidebar.tsx`
- Updated `frontend/src/App.tsx`
- Updated `frontend/src/components/NotificationCenter.tsx`
- Updated `frontend/src/components/TopNavbar.tsx`
- Updated `backend/app/services/tickets.py`
- Updated `ALERTS_UI_CHANGELOG.md`
- Updated `README.md`

## Tech Stack

### Backend
- **Web Framework**: FastAPI
- **Database**: MongoDB
- **Async Driver**: Motor
- **Data Validation**: Pydantic + Pydantic Settings
- **Authentication**: python-jose (JWT), bcrypt (hashing)
- **LLM Integration**: Google Gemini (gemini-2.5-flash), OpenAI (optional fallback)
- **Embeddings**: Gemini text-embedding-004
- **Vector Store**: FAISS
- **Document Parsing**: PyMuPDF (PDF), python-docx (DOCX)
- **ASGI Server**: Uvicorn

### Frontend
- **UI Library**: React 18
- **Language**: TypeScript 5
- **Build Tool**: Vite
- **Routing**: React Router
- **Icons**: Lucide
- **Styling**: Custom utility-first CSS
- **State Management**: Context API

## Project Structure

```
ITSM-HELPDESK/
├── backend/                      # FastAPI backend service
│   ├── app/
│   │   ├── api/             # API routers (auth, chat, tickets, documents, admin, health)
│   │   ├── auth/            # Authentication logic & security
│   │   ├── config/          # Environment configuration
│   │   ├── database/        # MongoDB setup & seed
│   │   ├── prompts/         # AI system prompts
│   │   ├── rag/             # Complete RAG pipeline (chunker, loader, retriever, vector store, etc.)
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic services (tickets, embedding, LLM, search)
│   │   └── utils/           # Utility functions
│   ├── uploads/             # Uploaded documents
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components (Dashboard, TicketDashboard, AIChat, etc.)
│   │   ├── shared/          # Shared types, API client, AppContext
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── knowledge_base/          # Synthetic enterprise knowledge base
├── DOCUMENTATION/            # Developer documentation
└── *.md                      # Root documentation files
```

## API Endpoints

All endpoints are prefixed with `/api`.

### Health Check
- `GET /api/health` - Health check endpoint

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login (returns access & refresh tokens)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user profile

### Tickets
- `GET /api/tickets` - List tickets (with filters: search, status, priority, assigned_team)
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/{ticket_id}` - Get ticket by ID
- `PUT /api/tickets/{ticket_id}` - Update ticket
- `DELETE /api/tickets/{ticket_id}` - Delete ticket
- `POST /api/tickets/{ticket_id}/assign` - Assign ticket to agent
- `POST /api/tickets/{ticket_id}/escalate` - Escalate ticket priority
- `POST /api/tickets/{ticket_id}/resolve` - Resolve ticket
- `POST /api/tickets/{ticket_id}/close` - Close ticket
- `POST /api/tickets/{ticket_id}/reopen` - Reopen ticket
- `GET /api/tickets/{ticket_id}/audit-logs` - Get ticket audit logs
- `POST /api/tickets/{ticket_id}/comments` - Add comment to ticket
- `GET /api/tickets/{ticket_id}/comments` - Get ticket comments

### Chat & AI
- `POST /api/chat` - AI chat with RAG
- `POST /api/chat/analyze-ticket` - Analyze ticket description and suggest fields (category, priority, etc.)

### Documents & Knowledge Base
- `GET /api/documents` - List knowledge base documents
- `POST /api/documents/upload` - Upload document
- `GET /api/documents/{document_id}` - Get document details
- `GET /api/documents/{document_id}/download` - Download document
- `POST /api/documents/search` - Semantic search over documents

### Admin
- `GET /api/admin/stats` - Get dashboard statistics

## Environment Variables

Create a `backend/.env` file (copy from [backend/.env.example](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\backend\.env.example)):

| Variable | Description | Default |
|----------|-------------|---------|
| APP_NAME | Application name | Enterprise ITSM Helpdesk AI Copilot API |
| APP_VERSION | Application version | 0.1.0 |
| ENVIRONMENT | Environment (development/production) | development |
| DEBUG | Debug mode | False |
| MONGODB_URI | MongoDB connection URI | mongodb://localhost:27017 |
| DATABASE_NAME | MongoDB database name | itsm_helpdesk |
| CORS_ORIGINS | Comma-separated allowed CORS origins | http://localhost:3000 |
| LOG_LEVEL | Logging level | INFO |
| JWT_SECRET_KEY | Secret key for JWT signing | change-me-in-local-env |
| JWT_ALGORITHM | JWT algorithm | HS256 |
| ACCESS_TOKEN_EXPIRE_MINUTES | Access token expiry in minutes | 30 |
| REFRESH_TOKEN_EXPIRE_DAYS | Refresh token expiry in days | 7 |
| GEMINI_API_KEY | Google Gemini API key (required for AI) | - |
| GEMINI_MODEL | Gemini model name | gemini-2.5-flash |
| OPENAI_API_KEY | OpenAI API key (optional fallback) | - |
| LLM_PROVIDER | LLM provider (gemini/openai) | gemini |
| CHAT_MODEL | Chat model name | gemini-2.5-flash |
| EMBEDDING_PROVIDER | Embedding provider (gemini/openai) | gemini |
| EMBEDDING_MODEL | Embedding model name | text-embedding-004 |

## AI Pipeline

### Knowledge Base
The `knowledge_base/` directory contains a complete, realistic enterprise knowledge base for EnterpriseTech Solutions, ready for ingestion into the RAG pipeline.

### Embeddings
- Embedding Model: Gemini text-embedding-004
- Chunking Strategy: Recursive character splitting with metadata extraction

### Vector Search
- Vector Store: FAISS (in-memory for dev, persisted to disk for prod)
- Search Method: Cosine similarity
- Chunk Size: Configurable

### Gemini
- LLM Provider: Google Gemini
- Models:
  - Chat: gemini-2.5-flash
  - Embeddings: text-embedding-004
  - Fallback: OpenAI (optional)

### RAG Flow
1. **Document Ingestion** → 2. Parsing → 3. Chunking → 4. Embedding Generation → 5. Vector Storage
2. **Query Ingestion** → 6. Query Embedding → 7. Similarity Search → 8. Context Retrieval → 9. Prompt Augmented Generation → 10. Response

### Ticket Analysis Flow
1. **Ticket Description** → 2. Gemini Ticket Analysis → 3. Returns category, priority, department, tags, confidence, root cause, resolution, SLA → 4. Auto-assign team based on category → 5. Store AI analysis fields with ticket

## Database Collections

MongoDB database name: `itsm_helpdesk`

| Collection | Description |
|------------|-------------|
| users | User accounts (email, name, role, hashed password, etc.) |
| tickets | Incident tickets (title, description, category, priority, status, assigned_to, assigned_team, ai_analysis_*, created_by, created_at, updated_at, etc.) |
| comments | Ticket comments |
| audit_logs | Ticket audit trail for all state changes |
| knowledge_documents | Knowledge base documents |
| document_chunks | Chunked document data for RAG |
| chat_history | Chat history (persisted) |

## Deployment

### Backend (Render)
Deploy the `backend/` directory on Render as a FastAPI service. Set environment variables in Render dashboard.

### Frontend (Vercel)
Deploy the `frontend/` directory on Vercel. Set `VITE_API_BASE_URL` to point to your Render backend.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn
- MongoDB (local or Atlas)
- Google Gemini API key

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open at http://localhost:3000

### Backend Setup
1. Create venv and install dependencies
```bash
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
pip install -r requirements.txt
```
2. Create .env from .env.example
```bash
cp .env.example .env
```
3. Edit .env and add your Gemini API key and MongoDB URI
4. Run backend
```bash
uvicorn app.main:app --reload
```
Backend API at http://127.0.0.1:8000, docs at /docs

## Demo Credentials
- Admin: admin@enterprise.com / password123
- Agent: agent@enterprise.com / password123
- Employee: user@enterprise.com / password123

## Key Documentation
- [PROJECT_CONTEXT.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\PROJECT_CONTEXT.md) - Project goals and business requirements
- [ARCHITECTURE.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\ARCHITECTURE.md) - Architecture overview
- [DEVELOPMENT_ROADMAP.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\DEVELOPMENT_ROADMAP.md) - Milestone-based roadmap
- [API_REFERENCE.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\API_REFERENCE.md) - Full API reference
- [AI_CONTEXT.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\AI_CONTEXT.md) - Instructions for future AI assistants
- [PROJECT_STATUS.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\PROJECT_STATUS.md) - Feature completion status
- [DOCUMENTATION/SETUP.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\DOCUMENTATION\SETUP.md) - Developer setup guide
- [DOCUMENTATION/CODING_GUIDELINES.md](file:///c:\Users\aryan.nagpal\ITSM-HELPDESK\DOCUMENTATION\CODING_GUIDELINES.md) - Coding standards

## License
MIT

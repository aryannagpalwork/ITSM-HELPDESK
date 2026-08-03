# AI Context

## Current Architecture

The project is a production-ready AI-enabled ITSM helpdesk.
- **Frontend**: React + TypeScript + Vite SPA with modern UI, real API integration, fallback mock data
- **Backend**: FastAPI + Motor (async MongoDB driver) + JWT auth + complete RAG pipeline
- **AI Layer**: Google Gemini for chat, ticket analysis, and embeddings; OpenAI as optional fallback
- **RAG Layer**: Complete implementation for document ingestion (PDF, DOCX, TXT, Markdown), chunking, vector storage with FAISS, and semantic search
- **Database**: MongoDB (collections: users, tickets, comments, audit_logs, knowledge_documents, document_chunks, chat_history)
- **Deployment**: Render (backend), Vercel (frontend)

## Current Implementation Status

### Backend
- ✅ JWT-based Authentication with refresh tokens
- ✅ Multi-user Registration & Login
- ✅ Role-based Access Control (Employee / Agent / Admin roles)
- ✅ Ticket CRUD operations with audit logging
- ✅ Comments API for tickets
- ✅ Chat endpoint `/chat` with RAG integration
- ✅ Chat endpoint `/chat/analyze-ticket` for ticket analysis
- ✅ Documents endpoints `/documents` for upload, download, semantic search
- ✅ Complete RAG pipeline
- ✅ Audit logging for all ticket state changes (reason field mandatory)
- ✅ MongoDB persistence
- ✅ AI Ticket Analysis (stores category, priority, department, tags, confidence, possible root cause, suggested resolution, estimated SLA with ticket)
- ✅ Smart Ticket Routing (auto-assigns team based on AI category)
- ✅ Admin stats endpoint

### Frontend
- ✅ AI Chat page that uses real backend `/chat` API (displays confidence, source citations, retrieved docs)
- ✅ Ticket Dashboard and Details pages using real backend API
- ✅ Dashboard showing AI Priority, Assigned Team, Estimated SLA on tickets
- ✅ Ticket Details page showing full AI analysis and assigned team
- ✅ Fallback logic for API failures (uses localStorage and mock data)
- ✅ Employee/Agent/Admin-specific views

### Synthetic Knowledge Base
The `knowledge_base/` directory contains a complete, realistic enterprise knowledge base for **EnterpriseTech Solutions**.

## Important Implementation Decisions
- Backend uses MongoDB with Motor async driver (not SQLAlchemy/SQLite)
- AI analysis fields are stored directly in ticket documents
- Smart Ticket Routing uses keyword-based category-to-team mapping (no LLM required for routing)
- Ticket schema includes `assigned_team` and all `ai_analysis_*` fields
- Frontend uses snake_case to camelCase mapping in API client
- Every ticket state change requires a reason for audit logs

## Must Never Change
- Do not alter existing ticket model semantics or endpoint contracts without updating API docs
- Do not remove backend auth dependency patterns (`get_current_user`, `require_roles`)
- Do not convert repo to a single app without preserving frontend/backend separation
- Do not hardcode secrets or replace placeholder JWT secret defaults without environment-based config
- Do not remove existing mock data patterns in frontend
- Do not change RAG architecture's abstract base classes (ABCs) in `backend/app/rag/`
- Do not remove audit logging for ticket state changes (reason field is mandatory)
- Do not change AI context storage pattern (store directly with tickets)

## Known Limitations
- Knowledge Base page still uses mock data (backend endpoints are available)
- No unit/integration tests yet
- No user feedback for AI responses yet
- No user profile management yet

## Future Roadmap (Planned)
- Enhance Knowledge Base page to use backend `/documents` endpoints
- Add user profile management
- Add admin dashboard analytics
- Add user feedback for AI responses
- Improve error handling and loading states in frontend
- Add comprehensive unit and integration tests
- Add more ticket filtering options
- Add export/import for tickets
- Add SLA alerts

## Coding Style
- Prefer explicit TypeScript types and Pydantic schemas
- Keep frontend state logic in `AppContext` and avoid one-off component state duplication
- Use service functions in backend for business rules rather than inline logic in routers
- Keep AI prompt/behavior definitions in dedicated prompt files
- Follow enterprise architecture patterns with separation of concerns
- Use Motor async methods for all MongoDB operations
- Use snake_case in backend, camelCase in frontend

## Preferred Technologies
- Python 3.11+, FastAPI, Motor, Pydantic, Pydantic Settings
- React 18+, TypeScript 5+, Vite, React Router, Lucide
- Gemini / Google GenAI for chat, ticket analysis, embeddings
- OpenAI (optional fallback)
- FAISS for vector similarity
- PyMuPDF (fitz) for PDF parsing
- python-docx for DOCX parsing
- MongoDB for persistence

## Project Philosophy
- Build clean separation between UI, API, data models, and AI orchestration
- Preserve strong domain model for tickets and users
- Keep AI layer additive, not invasive, to support workflow
- Prioritize maintainability over early optimization
- Document architecture so future AI assistants can continue development with minimal handoff
- Audit every ticket state change for compliance

## Folder Structure
```
ITSM-HELPDESK/
├── backend/                      # FastAPI backend service
│   ├── app/
│   │   ├── api/             # API routers
│   │   ├── auth/            # Authentication logic & security
│   │   ├── config/          # Environment configuration
│   │   ├── database/        # MongoDB setup & seed
│   │   ├── prompts/         # AI prompts
│   │   ├── rag/             # RAG pipeline components
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic services
│   │   └── utils/           # Utility functions
│   ├── uploads/             # Uploaded documents
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── shared/          # Shared types, API, context
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── knowledge_base/          # Synthetic enterprise knowledge base
├── DOCUMENTATION/            # Developer documentation
└── *.md                      # Root documentation files
```

## Current Project Status

### Completed ✅
- JWT Authentication
- Multi-user Registration & Login
- Role-based Access Control
- MongoDB Persistence
- AI Chat Copilot with RAG
- Knowledge Base Document Ingestion
- RAG-powered Semantic Search
- Incident Creation Workflow
- AI Ticket Analysis
- Smart Ticket Routing (auto-assign team)
- Dashboard (User/Agent/Admin views)
- Ticket Dashboard
- Ticket Details Page
- Audit Logging

### In Progress 🚧
- (None currently)

### Planned 📌
- Enhance Knowledge Base page to use real API
- User Profile Management
- Admin Dashboard Analytics
- User Feedback for AI Responses
- Error Handling & Loading States
- Unit & Integration Tests
- SLA Alerts

# Features

## Core Features

- Ticket management
  - Create new incident tickets
  - List and filter tickets
  - View ticket details and comments
  - Update ticket status, priority, and assignment
  - Delete tickets (admin only)
- Authentication
  - User login
  - Refresh tokens
  - Logout
- User roles
  - Employee / end user
  - Support agent
  - Administrator
- Knowledge base
  - SOP article listing and category filtering
  - Knowledge article creation in frontend mock environment
- AI Chat
  - AI chat interface page for support conversations
  - Simulated RAG retrieval experience
- Admin interface
  - Metrics dashboard and admin controls
- Local persistence
  - Browser localStorage fallback for ticket and KB state
  - Backend SQLite seed data for demo users and incidents

## RAG / AI Features (Conceptual)

- Document ingestion and management
- Semantic retrieval using embeddings and FAISS
- AI-generated troubleshooting recommendations
- Suggested ticket creation from chat sessions
- Source citation and confidence scoring
- Knowledge-aware prompt engineering via system instructions

## Project Status Indicators

- Implemented: ticket core, authentication, frontend UI, seed data.
- Partially implemented: AI chat UI, knowledge base mock behavior, backend scaffolding.
- Pending: document ingestion, actual RAG retrieval, LLM integration, production deployment.

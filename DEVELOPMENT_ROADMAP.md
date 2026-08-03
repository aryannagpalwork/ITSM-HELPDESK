# Development Roadmap

## Milestone 1: Project Foundation

- Establish monorepo structure with frontend and backend.
- Implement React/Vite frontend skeleton and navigation.
- Create FastAPI backend scaffold with CORS and logging.
- Define database models and `sqlalchemy` session setup.
- Seed demo data for users, tickets, and comments.

## Milestone 2: Authentication

- Implement `/auth/login`, `/auth/refresh`, and `/auth/logout` endpoints.
- Add JWT bearer token creation and validation.
- Create authentication dependencies and role-based authorization.
- Add frontend login flow and local session storage.
- Document auth contract in `API_REFERENCE.md`.

## Milestone 3: Ticket Management

- Implement ticket CRUD endpoints in `/tickets`.
- Implement `create_ticket`, `list_tickets`, `get_ticket`, `update_ticket`, and `delete_ticket` services.
- Add ticket filtering, search, pagination, and sorting.
- Integrate ticket APIs with frontend ticket pages.
- Add ticket details, comments, and agent views.

## Milestone 4: Knowledge Base

- Persist knowledge articles in `knowledge_documents`.
- Build document ingestion and listing endpoint.
- Create the `KnowledgeBase` page.
- Add search and category filtering.
- Build knowledge article creation workflow for admins.

## Milestone 5: RAG

- Implement document chunking and embedding pipeline.
- Add a vector store abstraction for FAISS or external vector DB.
- Build a retriever service for semantic search.
- Expose `/documents` and `/chat` endpoints for RAG queries.
- Add source citation and confidence score support.

## Milestone 6: Gemini AI

- Integrate Gemini / Google GenAI or chosen LLM provider.
- Build AI prompt orchestration and system instructions.
- Implement chat-based ticket suggestions and AI summaries.
- Add fallback logic and robust prompt engineering.
- Add detailed handling for ticket creation from chat sessions.

## Milestone 7: Deployment

- Harden backend configuration for production environments.
- Add Docker support and deployment manifests.
- Add CI/CD pipelines for tests, linting, and deploys.
- Configure secrets management and environment validation.
- Deploy frontend static assets behind a secure hosting layer.
- Add monitoring and observability for uptime and errors.

## Future Enhancements

- Real-time notifications and agent alerts.
- Support attachments and ticket file uploads.
- Integrate with enterprise directory services.
- Add full audit history and event tracing.
- Add e2e tests for major workflows.

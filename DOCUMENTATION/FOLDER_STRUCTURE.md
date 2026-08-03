# Folder Structure

## Root

- `README.md` : High-level project overview and quick start.
- `PROJECT_CONTEXT.md` : Project goals, business problem, users, and behavior.
- `ARCHITECTURE.md` : System architecture, diagrams, and component descriptions.
- `DEVELOPMENT_ROADMAP.md` : Milestone-based roadmap.
- `API_REFERENCE.md` : Backend endpoint and schema documentation.
- `AI_CONTEXT.md` : AI assistant instructions and assumptions.
- `PROJECT_STATUS.md` : Completed, partial, and pending feature list.
- `FEATURES.md` : Feature matrix and status.
- `DOCUMENTATION/` : Setup, coding guidelines, and folder structure docs.

## backend/

- `requirements.txt` : Python dependencies.
- `app/main.py` : FastAPI application entrypoint and lifespan manager.
- `app/api/` : API routers for health, auth, chat, tickets, documents, and admin.
- `app/auth/` : Authentication and authorization utilities.
- `app/config/` : Runtime settings and logging configuration.
- `app/database/` : SQLAlchemy setup, base, and demo data seeding.
- `app/models/` : SQLAlchemy ORM models.
- `app/schemas/` : Pydantic request and response schemas.
- `app/services/` : Business logic for ticket operations.
- `app/rag/` : Retrieval augmented generation pipeline placeholder.
- `app/prompts/` : AI system prompts.
- `app/utils/` : Shared utilities (empty or reserved).

## frontend/

- `package.json` : npm scripts and dependency declarations.
- `tsconfig.json` : TypeScript compiler configuration.
- `vite.config.ts` : Vite configuration.
- `src/App.tsx` : Router and top-level app layout.
- `src/components/Sidebar.tsx` : Sidebar navigation component.
- `src/pages/` : Page components for landing, login, dashboard, chat, tickets, knowledge base, settings, and admin.
- `src/shared/api.ts` : Client-side API calls, auth token storage, and mapping logic.
- `src/shared/AppContext.tsx` : Global app state and context provider.
- `src/shared/types.ts` : Frontend TypeScript type definitions.
- `src/shared/mockData.ts` : Mock data for users, tickets, comments, and knowledge.

## docs/

- Existing repository documentation or placeholder documentation.

## knowledge_base/

- `it_support_kb.json` : Seed knowledge base data for IT support documentation.

## uploads/

- Runtime folder for uploaded documents or attachments.

## scripts/

- Operational scripts and tooling documentation.

## tests/

- Test suites for backend and frontend.

## Notes

- The project uses separate frontend and backend apps to simplify development and deployment.
- The backend is the authoritative source for ticket and auth data.
- The frontend currently uses a hybrid model with backend API calls plus local mock state.

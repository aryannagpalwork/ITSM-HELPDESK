# Coding Guidelines

## Naming Conventions

- Use `PascalCase` for React components, Pydantic models, and ORM classes.
- Use `camelCase` for JavaScript/TypeScript variables and functions.
- Use `snake_case` for Python functions, variables, and SQLAlchemy models.
- Use descriptive names for endpoints, services, and schemas.

## Folder Conventions

- Keep frontend and backend code separated by top-level folders.
- Place API routing logic in `backend/app/api/`.
- Place backend business rules in `backend/app/services/`.
- Place shared frontend state in `frontend/src/shared/`.
- Keep UI pages in `frontend/src/pages/`.

## Dependency Injection

- Use FastAPI dependencies for database sessions and auth.
- Use `Depends(get_db)` or `Depends(get_current_user)` in route handlers.
- Keep service functions independent of FastAPI request state when possible.

## Error Handling

- Raise `HTTPException` for API errors with clear status codes and messages.
- Avoid swallowing exceptions in service layers.
- Return `501 Not Implemented` for stubbed routes that are intentionally incomplete.
- On the frontend, catch network errors and fall back to local mock data when needed.

## Logging

- Use the central logging configuration in `backend/app/config/logging.py`.
- Log startup/shutdown messages and errors in backend lifecycle events.
- Do not log sensitive data such as passwords or JWT secrets.

## Testing

- Add unit tests for backend service functions and route handlers.
- Add integration tests for API contract behavior.
- Add frontend component tests for critical pages and shared context.
- Validate new features with manual UI testing and API calls.

## Formatting

- Keep Python formatting consistent with PEP 8.
- Keep TypeScript formatting consistent with Prettier-style rules.
- Use descriptive comments for non-obvious business rules.
- Keep UI markup readable by splitting large JSX blocks into smaller components.

## AI / RAG Documentation

- Keep AI prompting logic in dedicated files like `backend/app/prompts/system_instructions.txt`.
- Document intended AI behavior rather than encoding it in route code.
- Do not hardcode AI provider secrets into repository files.

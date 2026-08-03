# Setup

## Prerequisites

- Node.js 20+ (for frontend)
- Python 3.11+ (for backend)
- Git

## Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the app in the browser at `http://localhost:3000`.

## Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the virtual environment:
   - Windows PowerShell:
     ```powershell
     .\.venv\Scripts\Activate.ps1
     ```
   - macOS / Linux:
     ```bash
     source .venv/bin/activate
     ```
4. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
5. Start the backend server:
   ```bash
   uvicorn app.main:app --reload
   ```
6. The backend will run at `http://127.0.0.1:8000`.

## Environment Configuration

- The backend reads environment variables from `backend/.env` when available.
- The current settings are defined in `backend/app/config/settings.py`.
- Key environment variables:
  - `APP_NAME`
  - `APP_VERSION`
  - `ENVIRONMENT`
  - `DEBUG`
  - `DATABASE_URL`
  - `CORS_ORIGINS`
  - `LOG_LEVEL`
  - `JWT_SECRET_KEY`
  - `JWT_ALGORITHM`
  - `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `REFRESH_TOKEN_EXPIRE_DAYS`

## Database

- The backend uses SQLite by default.
- The default database path is `backend/itsm_helpdesk.db`.
- On startup, the backend creates tables and seeds demo data automatically.
- To reset the database, delete the `backend/itsm_helpdesk.db` file and restart the backend.

## Notes

- The frontend uses `VITE_API_BASE_URL` to identify the backend base URL.
- If the backend runs on a different port or host, update `frontend/.env` or `vite.config.ts` accordingly.
- For production deployment, replace SQLite with a managed database and secure JWT secret values.

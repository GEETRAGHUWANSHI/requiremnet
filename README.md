# Requirement Lens

Requirement Lens is an AI-powered client requirement analyzer built for the assignment brief. It accepts pasted requirements or PDF/TXT uploads, extracts the original text, produces structured project documentation, and stores analyses in SQLite for later review.

## Stack

- Frontend: React + Vite
- Backend: Python + FastAPI
- AI: OpenAI API when `OPENAI_API_KEY` is configured; deterministic offline demo analysis otherwise
- Database: SQLite
- Documents: PyPDF

## Run locally

### Backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

If the project environment is not available, use the Python interpreter selected by your environment manager. Optional AI configuration:

```powershell
$env:OPENAI_API_KEY="your-key"
$env:OPENAI_MODEL="gpt-4o-mini"
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The API runs at http://localhost:8000 and exposes interactive docs at http://localhost:8000/docs.

## Architecture

The React client owns the input workspace, result presentation, and saved-analysis library. FastAPI provides a small REST API: `/api/extract` handles PDF/TXT parsing, `/api/analyze` creates structured output, and `/api/analyses` reads saved work. SQLite stores the original requirement text and the complete JSON result. The backend uses an OpenAI structured JSON request when available and falls back to an offline sample-aware analyzer, keeping the application easy to demonstrate without exposing credentials.

## Output schema

Each result contains a project overview, objectives, feature breakdown, functional and non-functional requirements, missing information, ambiguities, contradictions, client questions, user stories with acceptance criteria, and basic test cases.

## Security notes

API keys are read from environment variables only. No credentials are committed. For production, add authentication, rate limiting, encrypted secrets, a managed database, and stricter CORS configuration.

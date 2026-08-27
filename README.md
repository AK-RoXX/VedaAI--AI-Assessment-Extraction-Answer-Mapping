# VedaAI

VedaAI is an AI-assisted teacher tool for reviewing handwritten exam answers. Upload a question paper and one answer sheet, then inspect extracted questions, mapped answers, marks, feedback, and highlighted answer regions.

## Features

- Upload PDF or image files (10 MB per file).
![VedaAI upload interface](documents/upload%20feature.png)

- Extract questions in printed order, including labelled sub-parts.
![VedaAI question extracted](documents/answer%20extracted.png)

- Detect answers written out of order, unanswered questions, and unmatched answers.

- Highlight answer regions on the answer-sheet page.
![VedaAI upload interface](documents/answer%20page.png)

- Grade extracted answers with Gemini and stream processing progress over SSE.

- Support answers spanning multiple answer-sheet pages.

## Architecture

```text
frontend/   Next.js App Router, React, TypeScript, CSS Modules
backend/    FastAPI, PyMuPDF, Pillow, Gemini API
documents/  Sample input documents
```

The backend keeps sessions in memory. Restarting the backend removes uploaded files and results; no database or authentication is currently used.

## Requirements

- Node.js 18+
- Python 3.10+
- A Google Gemini API key (and optionally an OpenRouter key for text fallback)

## Run locally

### Backend

```bash
cd backend
python -m venv .venv

# Windows PowerShell
.\\.venv\\Scripts\\Activate.ps1

# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
# Optional text-only fallback
OPEN_ROUTER_API_KEY=your_openrouter_key
# Public frontend URL used for OpenRouter app attribution
OPENROUTER_SITE_URL=https://your-frontend-service.onrender.com
# Optional free vision fallback chain (images are sent to these models)
OPENROUTER_VISION_MODELS=qwen/qwen2.5-vl-72b-instruct:free,google/gemma-3-27b-it:free,google/gemma-3-12b-it:free,qwen/qwen2.5-vl-7b-instruct:free
```

Start the API from the `backend` directory:

```bash
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Start the web app with `npm run dev` and open <http://localhost:3000>.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| POST | `/api/upload` | Create a processing session |
| GET | `/api/process/{session_id}` | SSE processing updates |
| GET | `/api/results/{session_id}` | Final questions, answers, and grades |
| GET | `/api/page-image/{session_id}/{doc}/{page}` | Render a page as PNG |
| GET | `/api/session-info/{session_id}` | Session status and filenames |

`doc` is `question` or `answer`; page indexes are zero-based.

## Development checks

```bash
# Frontend
cd frontend
npm run lint
npm run build

# Backend
cd ../backend
python -m compileall .
```

## Processing flow

```text
Upload -> render pages -> extract questions -> extract answers
-> map IDs -> grade -> display results and highlighted regions
```

## Limitations (features and systems that need to be handled in future but not required currently in the assessment)

- Results depend on model/API quota and handwriting quality.
- In-memory sessions are intended for local/demo use and are not durable or multi-worker safe.
- Classroom and Library navigation items are currently placeholders.

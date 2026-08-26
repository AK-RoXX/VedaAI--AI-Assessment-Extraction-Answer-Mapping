# VedaAI – AI Teacher's Toolkit

VedaAI is a full-stack web application designed for educators to upload exam question papers alongside student handwritten answer sheets. VedaAI automatically extracts questions, transcribes handwritten answers, maps answers to respective questions, highlights exact answer regions on the answer sheet image and provides automated scoring with AI Analysis and feedback.

---

## 🏗️ Architecture & Folder Structure

The project is structured into two main directories: `frontend` (Next.js 14) and `backend` (Python FastAPI).

```
VedaAI/
├── frontend/                     # Next.js 14 App Router (Frontend)
│   ├── app/
│   │   ├── page.tsx              # Step 1: Upload Question Paper & Answer Sheet
│   │   ├── processing/
│   │   │   └── [sessionId]/
│   │   │       └── page.tsx      # Step 2: AI Extraction Progress Screen
│   │   └── results/
│   │       └── [sessionId]/
│   │           └── page.tsx      # Step 3: Interactive Split-View (Questions + Sheet Viewer)
│   ├── components/               # Custom UI Components 
│   ├── lib/                      # TypeScript definitions & API helper
│   ├── .env.local                # Frontend environment configuration
│   └── package.json
│
├── backend/                      # Python FastAPI (Backend)
│   ├── main.py                   # FastAPI REST & SSE endpoints
│   ├── pipeline.py               # AI Extraction, Mapping & Grading engine (Gemini API)
│   ├── models.py                 # Pydantic data schemas
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Sample environment file for Gemini API Key
│
├── Context.md                    # Project requirements and specification
├── README.md                     # Project documentation and setup guide
└── Screenshots/                  # Design reference screenshots
```

---

## 🛠️ Tech Stack

| Layer | Technology | Key Modules / Libraries |
|-------|-----------|------------------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | CSS Modules, Vanilla CSS Design System, SVG Animations |
| **Backend** | Python 3.10+ / 3.13, FastAPI, Uvicorn | `google-genai` (Gemini 2.0/1.5), `pymupdf`, `pillow`, `pydantic` |
| **AI Model** | Google Gemini Vision & Text API | Question extraction, handwriting OCR + bbox estimation, AI grading |
| **Communication** | REST API & Server-Sent Events (SSE) | Multipart uploads, realtime progress streaming, image server |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: v3.10 or higher
- **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Backend Setup (`/backend`)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - **Windows (PowerShell/CMD)**:
     ```bash
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Create a `.env` file inside the `backend/` folder (or copy the example):
   ```bash
   cp .env.example .env   # macOS/Linux
   copy .env.example .env # Windows
   ```
   Open `backend/.env` and add at least one valid Gemini API key. You may provide multiple keys for fallback (e.g., `GEMINI_API_KEY`, `GEMINI_API_KEY2`, `GEMINI_API_KEY_3`):
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   # Optional additional keys
   GEMINI_API_KEY2=second_key
   GEMINI_API_KEY_3=third_key
   ```

5. **Start the FastAPI Backend Server**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will run at **http://localhost:8000**.*  
---

### Step 2: Frontend Setup (`/frontend`)

1. **Open a new terminal and navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file inside the `frontend/` folder:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

4. **Start the Next.js Development Server**:
   ```bash
   npm run dev
   ```
   *The frontend will run at **http://localhost:3000**.*

---

## 📑 Core Processing Flow

```
[Teacher Uploads PDF/Images] ──> POST /api/upload ──> Session Created (UUID)
                                                             │
[Redirect to /processing] <── SSE Stream (/api/process) <───┤
  ├── 1. Convert PDF pages to PNG (PyMuPDF)                 │
  ├── 2. Question Extraction (Gemini Vision)                │
  ├── 3. Answer Handwriting OCR & Bounding Boxes            │
  ├── 4. Question-to-Answer Mapping & Unanswered Detection    │
  └── 5. AI Grading & Constructive Feedback                 │
                                                             ▼
[Redirect to /results] <── GET /api/results ───────── [Processing Done]
  ├── Left Panel: Interactive Question List & AI Scores
  └── Right Panel: High-Res Answer Sheet Viewer + Green Highlights
```

---

## 📡 Backend API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Backend status check endpoint. |
| `POST` | `/api/upload` | Receives `question_paper` and `answer_sheet` files (max 10MB each). Returns `session_id`. |
| `GET` | `/api/process/{session_id}` | **Server-Sent Events (SSE)** endpoint. Streams realtime step-by-step progress and status updates. |
| `GET` | `/api/results/{session_id}` | Retrieves final processed JSON containing extracted questions, mapped answers with bounding boxes, scores, and feedback. |
| `GET` | `/api/page-image/{session_id}/{doc}/{page}` | Serves rendered page images (`doc`: `question` or `answer`, `page`: 0-indexed integer) as PNGs. |
| `GET` | `/api/session-info/{session_id}` | Returns basic session info and status. |

---

## 💡 Highlights & Features

- 📸 **Exact Answer Region Highlighting**: Dynamic, scaled SVG/CSS overlays highlight answer regions directly on the handwritten answer sheet.
- 🔢 **Order Agnostic & Sub-part Handling**: Detects questions answered out of order, and handles sub-questions (e.g. `11(a)`, `11(b)`).
- 🚫 **Unanswered & Unmatched Answers**: Clearly marks unanswered questions and identifies student answers not matching any question.

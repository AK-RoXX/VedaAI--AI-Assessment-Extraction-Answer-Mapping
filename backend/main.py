"""
VedaAI FastAPI Backend
"""

import io
import uuid
import asyncio
from typing import Any
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from PIL import Image

from models import UploadResponse, ProcessingStatus, ProcessingResult
from pipeline import run_pipeline, pdf_to_images, image_to_bytes

app = FastAPI(title="VedaAI Backend", version="1.0.0")

# Allow Next.js dev server and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory session store
# ---------------------------------------------------------------------------
# sessions[session_id] = {
#   "question_bytes": bytes,
#   "answer_bytes":   bytes,
#   "question_images": list[PIL.Image],
#   "answer_images":   list[PIL.Image],
#   "status":  ProcessingStatus,
#   "result":  ProcessingResult | None,
# }
sessions: dict[str, dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
@app.get("/healthz")
async def health():
    return {"status": "ok"}


@app.post("/api/upload", response_model=UploadResponse)
async def upload_files(
    question_paper: UploadFile = File(...),
    answer_sheet: UploadFile = File(...),
):
    """Accept the two PDF uploads and return a session ID."""
    MAX_SIZE = 10 * 1024 * 1024  # 10 MB

    q_bytes = await question_paper.read()
    a_bytes = await answer_sheet.read()

    if len(q_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Question paper exceeds 10 MB limit.")
    if len(a_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Answer sheet exceeds 10 MB limit.")

    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "question_bytes": q_bytes,
        "answer_bytes": a_bytes,
        "question_filename": question_paper.filename,
        "answer_filename": answer_sheet.filename,
        "question_images": None,
        "answer_images": None,
        "status": ProcessingStatus(
            session_id=session_id,
            status="pending",
            step="Waiting to start…",
            progress=0,
        ),
        "result": None,
    }
    return UploadResponse(session_id=session_id, message="Files uploaded successfully.")


@app.get("/api/process/{session_id}")
async def process_session(session_id: str):
    """
    SSE endpoint — stream processing progress events then result.
    The client should connect via EventSource.
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")

    session = sessions[session_id]
    if session["status"].status == "done":
        # Already processed — return instant done event
        async def instant():
            yield f"data: {session['status'].model_dump_json()}\n\n"
        return StreamingResponse(instant(), media_type="text/event-stream")

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()

        async def progress_callback(step: str, pct: int):
            status = ProcessingStatus(
                session_id=session_id,
                status="processing",
                step=step,
                progress=pct,
            )
            session["status"] = status
            await queue.put(status.model_dump_json())

        async def run():
            try:
                result = await run_pipeline(
                    session_id=session_id,
                    question_bytes=session["question_bytes"],
                    answer_bytes=session["answer_bytes"],
                    progress_callback=progress_callback,
                )
                session["result"] = result
                # Pre-render page images
                session["question_images"] = pdf_to_images(session["question_bytes"])
                session["answer_images"] = pdf_to_images(session["answer_bytes"])

                done_status = ProcessingStatus(
                    session_id=session_id,
                    status="done",
                    step="Completed!",
                    progress=100,
                )
                session["status"] = done_status
                await queue.put(done_status.model_dump_json())
            except Exception as e:
                err_status = ProcessingStatus(
                    session_id=session_id,
                    status="error",
                    step="Error during processing.",
                    progress=0,
                    error=str(e),
                )
                session["status"] = err_status
                await queue.put(err_status.model_dump_json())
            finally:
                await queue.put(None)  # Sentinel

        asyncio.create_task(run())

        while True:
            item = await queue.get()
            if item is None:
                break
            yield f"data: {item}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/results/{session_id}", response_model=ProcessingResult)
async def get_results(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    session = sessions[session_id]
    if session["result"] is None:
        raise HTTPException(status_code=202, detail="Processing not complete yet.")
    return session["result"]


@app.get("/api/page-image/{session_id}/{doc}/{page}")
async def get_page_image(session_id: str, doc: str, page: int):
    """
    Serve a rendered page image as PNG.
    doc: "question" | "answer"
    page: 0-indexed page number
    """
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    session = sessions[session_id]

    if doc == "answer":
        images = session.get("answer_images")
    elif doc == "question":
        images = session.get("question_images")
    else:
        raise HTTPException(status_code=400, detail="doc must be 'question' or 'answer'.")

    if not images:
        # Lazy render
        key = "answer_bytes" if doc == "answer" else "question_bytes"
        images = pdf_to_images(session[key])
        session[f"{doc}_images"] = images

    if page < 0 or page >= len(images):
        raise HTTPException(status_code=404, detail=f"Page {page} out of range.")

    img_bytes = image_to_bytes(images[page])
    return Response(content=img_bytes, media_type="image/png")


@app.get("/api/session-info/{session_id}")
async def session_info(session_id: str):
    """Return basic info about the session (filenames, page counts, status)."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    s = sessions[session_id]
    return {
        "session_id": session_id,
        "question_filename": s.get("question_filename", ""),
        "answer_filename": s.get("answer_filename", ""),
        "status": s["status"].model_dump(),
    }

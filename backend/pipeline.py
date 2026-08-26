"""
AI Pipeline for VedaAI.
Handles PDF → images, Gemini-based question/answer extraction, mapping, and grading.
"""

import os
import io
import json
import base64
import re
import time
import asyncio
import urllib.request
from typing import Any
import pymupdf  # PyMuPDF
from PIL import Image
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from models import Question, Answer, BoundingBox, GradingResult, ProcessingResult

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

MODEL_ID = "gemini-2.5-flash"
FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-3.6-flash"]
DPI = 120


def _get_api_keys() -> list[str]:
    keys = {
        v.strip()
        for k, v in os.environ.items()
        if k.startswith("GEMINI_API_KEY")
        and v
    }
    return list(keys)

def _call_openrouter_fallback(prompt: str) -> str:
    openrouter_key = os.getenv("OPEN_ROUTER_API_KEY", "").strip()
    if not openrouter_key:
        raise ValueError("OPEN_ROUTER_API_KEY not set")

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "VedaAI",
    }
    payload = {
        "model": "nvidia/nemotron-3.5-lightning:free",
        "messages": [{"role": "user", "content": prompt}],
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        text = data["choices"][0]["message"]["content"]
        class MockResponse:
            def __init__(self, t):
                self.text = t
        return MockResponse(text)


def _generate_content_with_retry(client: genai.Client | None, contents: Any, config: Any = None):
    """Generate content with automatic key rotation and model fallback on quota/rate limits."""
    api_keys = _get_api_keys()
    last_error = None

    for key in api_keys:
        try:
            active_client = genai.Client(api_key=key)
            for model in FALLBACK_MODELS:
                try:
                    return active_client.models.generate_content(model=model, contents=contents, config=config)
                except Exception as e:
                    last_error = e
                    continue
        except Exception as e:
            last_error = e
            continue

    # Fallback to OpenRouter text model if contents is text prompt
    if isinstance(contents, str) or (isinstance(contents, list) and len(contents) > 0 and isinstance(contents[0], str)):
        prompt_text = contents if isinstance(contents, str) else contents[0]
        try:
            return _call_openrouter_fallback(prompt_text)
        except Exception as or_err:
            pass

    if last_error:
        raise last_error


# ---------------------------------------------------------------------------
# PDF utilities
# ---------------------------------------------------------------------------

def pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """Convert all pages of a PDF to PIL Images."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    images = []
    mat = pymupdf.Matrix(DPI / 72, DPI / 72)
    for page in doc:
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    doc.close()
    return images


def image_to_base64(img: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _pil_to_part(img: Image.Image) -> genai_types.Part:
    """Convert a PIL image to a compressed JPEG google.genai Part for 10x network speed."""
    buf = io.BytesIO()
    # Convert to RGB if RGBA
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")
    img.save(buf, format="JPEG", quality=85)
    return genai_types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")


# ---------------------------------------------------------------------------
def _clean_and_parse_json(raw: str) -> Any:
    raw = raw.strip()
    match = re.search(r'(\[[\s\S]*\]|\{[\s\S]*\})', raw)
    if match:
        raw = match.group(1)
    else:
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\n?```$", "", raw)
        raw = raw.strip()
    return json.loads(raw)


def _normalize_id(s: str) -> str:
    s = str(s).strip()
    s = re.sub(r'^(question|ans|answer|q)[\.\s:]*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'[\(\)\.\s]', '', s)
    return s.lower()


# ---------------------------------------------------------------------------
# Step 1: Extract questions from question paper
# ---------------------------------------------------------------------------

QUESTION_EXTRACTION_PROMPT = """
You are an expert at reading printed academic question papers.

Analyze the provided image(s) of a question paper and extract every question in order.
Rules:
- Preserve the original question numbering (e.g. 1, 2, Q1, Q2, 11(a), 11(b)).
- Treat labelled sub-parts as separate entries (e.g. "11 (a)" and "11 (b)" are two questions).
- Include the marks assigned to each question if visible (look for text like "[2 marks]" or "(5)").
- Return ONLY valid JSON, no markdown fences, no explanation.

Output format (JSON array):
[
  {"id": "1", "text": "Full question text here", "max_marks": 2},
  {"id": "2", "text": "Full question text here", "max_marks": 5},
  {"id": "11a", "text": "Sub-part text", "max_marks": 3},
  {"id": "11b", "text": "Sub-part text", "max_marks": 2}
]
"""


def extract_questions(question_images: list[Image.Image]) -> list[Question]:
    parts: list = [QUESTION_EXTRACTION_PROMPT] + [_pil_to_part(img) for img in question_images]
    config = genai_types.GenerateContentConfig(response_mime_type="application/json")
    response = _generate_content_with_retry(None, contents=parts, config=config)
    data = _clean_and_parse_json(response.text)
    
    questions = []
    for item in data:
        qid = str(item.get("id", "")).strip()
        text = str(item.get("text", "")).strip()
        raw_marks = item.get("max_marks", 0)
        try:
            max_marks = int(float(raw_marks))
        except (ValueError, TypeError):
            max_marks = 0
        if qid and text:
            questions.append(Question(id=qid, text=text, max_marks=max_marks))
    return questions


# ---------------------------------------------------------------------------
# Step 2: Extract answers + bounding boxes from answer sheet
# ---------------------------------------------------------------------------

def _parse_bbox(bbox_data: Any, page: int) -> BoundingBox | None:
    if not bbox_data:
        return None
    try:
        if isinstance(bbox_data, dict):
            x0 = float(bbox_data.get("x0", bbox_data.get("xmin", bbox_data.get("left", 0))))
            y0 = float(bbox_data.get("y0", bbox_data.get("ymin", bbox_data.get("top", 0))))
            x1 = float(bbox_data.get("x1", bbox_data.get("xmax", bbox_data.get("right", 1))))
            y1 = float(bbox_data.get("y1", bbox_data.get("ymax", bbox_data.get("bottom", 1))))
        elif isinstance(bbox_data, (list, tuple)) and len(bbox_data) == 4:
            y0, x0, y1, x1 = [float(v) for v in bbox_data]
        else:
            return None

        # Normalize 0..1000 to 0.0..1.0
        if max(x0, y0, x1, y1) > 1.5:
            x0 /= 1000.0
            y0 /= 1000.0
            x1 /= 1000.0
            y1 /= 1000.0

        x0 = max(0.0, min(1.0, x0))
        y0 = max(0.0, min(1.0, y0))
        x1 = max(x0, min(1.0, x1))
        y1 = max(y0, min(1.0, y1))

        if (y1 - y0) < 0.02:
            y1 = min(1.0, y0 + 0.04)
        if (x1 - x0) < 0.05:
            x1 = min(1.0, x0 + 0.6)

        return BoundingBox(x0=round(x0, 4), y0=round(y0, 4), x1=round(x1, 4), y1=round(y1, 4), page=page)
    except Exception:
        return None


def extract_answers(answer_images: list[Image.Image], questions: list[Question] = None) -> list[Answer]:
    q_context = ""
    if questions:
        q_summary = "\n".join([f"- Question {q.id}: \"{q.text[:100]}\" ({q.max_marks} marks)" for q in questions])
        q_context = f"\nList of Expected Question IDs from Question Paper:\n{q_summary}\n"

    prompt = f"""
You are an expert OCR and document understanding engine for handwritten student exam papers.

Analyze the handwritten answer sheet image(s). Each image is one page (page index starts at 0).
{q_context}
DETECTION RULES:
1. Identify every handwritten answer on each page by looking at the leading question number written by the student (e.g. "1.", "2.", "3.", "4.", "Q5", "11 a.", etc.).
2. The `question_id` MUST match the leading question number written by the student (e.g., answer starting with "1." is question_id "1", answer starting with "2." is question_id "2", answer starting with "3." is question_id "3"). Do NOT skip or offset any numbers.
3. Transcribe the full answer text written on that line/section (including option letter and written text).
4. Provide the exact normalized bounding box [x0, y0, x1, y1] for that specific answer region:
   - x0 (left), y0 (top), x1 (right), y1 (bottom) as floats between 0.0 and 1.0.
   - y0 must be the top of the text line, y1 must be the bottom of that text line.
   - Do NOT overlap the bounding box of question 2 with question 3. Each answer must have its own tight, accurate box.

Output format (strict JSON array of objects):
[
  {{
    "question_id": "1",
    "text": "(C) Increased risk of cross-contamination",
    "page": 0,
    "bbox": {{"x0": 0.50, "y0": 0.46, "x1": 0.88, "y1": 0.50}}
  }},
  {{
    "question_id": "2",
    "text": "(C) Listing all the activities",
    "page": 0,
    "bbox": {{"x0": 0.50, "y0": 0.51, "x1": 0.80, "y1": 0.55}}
  }}
]
"""
    parts: list = [prompt] + [_pil_to_part(img) for img in answer_images]
    config = genai_types.GenerateContentConfig(response_mime_type="application/json")
    response = _generate_content_with_retry(None, contents=parts, config=config)
    data = _clean_and_parse_json(response.text)
    
    answers = []
    for item in data:
        page_idx = int(item.get("page", 0))
        bbox = _parse_bbox(item.get("bbox"), page=page_idx)
        answers.append(Answer(
            question_id=str(item.get("question_id", "unknown")).strip(),
            text=str(item.get("text", "")).strip(),
            bbox=bbox,
            status="answered",
        ))
    return answers


# ---------------------------------------------------------------------------
# Step 3: Map answers to questions
# ---------------------------------------------------------------------------

def map_answers_to_questions(
    questions: list[Question], answers: list[Answer]
) -> list[Answer]:
    """
    Mark answers as 'answered', 'unanswered', or 'unmatched'.
    Normalize question IDs so 'Q1', '1.', 'Ans 1' match to '1' or 'Q1'.
    """
    norm_to_q = {_normalize_id(q.id): q for q in questions}
    matched_q_ids = set()

    for a in answers:
        norm_a_id = _normalize_id(a.question_id)
        if norm_a_id in norm_to_q:
            q = norm_to_q[norm_a_id]
            a.question_id = q.id
            a.status = "answered"
            matched_q_ids.add(q.id)
        else:
            a.status = "unmatched"

    for q in questions:
        if q.id not in matched_q_ids:
            answers.append(Answer(
                question_id=q.id,
                text="",
                bbox=None,
                status="unanswered",
            ))

    return answers


# ---------------------------------------------------------------------------
# Step 4: High-Speed Batch AI Grading with Detailed Marks Justification
# ---------------------------------------------------------------------------

BATCH_GRADING_PROMPT = """
You are an experienced academic teacher grading student exam answers.

Analyze each student answer and grade it against its question text and maximum marks.
Rules:
1. marks_awarded must be an integer between 0 and max_marks.
2. Provide concise, constructive feedback with a clear score justification explaining how many marks were awarded and why.
   (e.g., "Awarded 2/2 marks: Correctly identified the organelle and described its primary function.")
3. Return ONLY a valid JSON array of objects.

Items to grade:
{items_json}

Required Output JSON format (array of objects):
[
  {{"question_id": "1", "marks_awarded": 2, "feedback": "Awarded 2/2 marks: ..."}}
]
"""


async def grade_answers_async(
    questions: list[Question], answers: list[Answer], notify_cb=None
) -> list[GradingResult]:
    """Batch grading in a single structured Gemini call for maximum speed."""
    answer_map = {a.question_id: a for a in answers if a.status == "answered"}
    
    items_to_grade = []
    grades_dict: dict[str, GradingResult] = {}
    
    for q in questions:
        ans = answer_map.get(q.id)
        if not ans or not ans.text.strip():
            grades_dict[q.id] = GradingResult(
                question_id=q.id,
                marks_awarded=0,
                max_marks=q.max_marks,
                feedback=f"Awarded 0/{q.max_marks} marks: Question was not answered.",
                is_correct=False,
            )
        else:
            items_to_grade.append({
                "question_id": q.id,
                "question_text": q.text,
                "max_marks": q.max_marks,
                "student_answer": ans.text,
            })

    if notify_cb:
        await notify_cb("Grading answers with AI…", 85)

    if items_to_grade:
        prompt = BATCH_GRADING_PROMPT.format(items_json=json.dumps(items_to_grade, indent=2))
        config = genai_types.GenerateContentConfig(response_mime_type="application/json")
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, _generate_content_with_retry, None, prompt, config
            )
            raw_grades = _clean_and_parse_json(response.text)
            for item in raw_grades:
                qid = str(item.get("question_id", "")).strip()
                if not qid:
                    continue
                q_obj = next((q for q in questions if q.id == qid), None)
                max_m = q_obj.max_marks if q_obj else 0
                try:
                    awarded = int(float(item.get("marks_awarded", 0)))
                except (ValueError, TypeError):
                    awarded = 0
                feedback = str(item.get("feedback", "")).strip() or f"Awarded {awarded}/{max_m} marks."
                is_correct = (awarded == max_m) if max_m > 0 else None
                grades_dict[qid] = GradingResult(
                    question_id=qid,
                    marks_awarded=awarded,
                    max_marks=max_m,
                    feedback=feedback,
                    is_correct=is_correct,
                )
        except Exception:
            for item in items_to_grade:
                qid = item["question_id"]
                if qid not in grades_dict:
                    grades_dict[qid] = GradingResult(
                        question_id=qid,
                        marks_awarded=0,
                        max_marks=item["max_marks"],
                        feedback="AI feedback not available.",
                        is_correct=False,
                    )

    # Ensure all questions have a result
    for q in questions:
        if q.id not in grades_dict:
            grades_dict[q.id] = GradingResult(
                question_id=q.id,
                marks_awarded=0,
                max_marks=q.max_marks,
                feedback="AI feedback not available.",
                is_correct=False,
            )

    if notify_cb:
        await notify_cb("Finalizing evaluation…", 95)

    return [grades_dict[q.id] for q in questions]


# ---------------------------------------------------------------------------
# Master pipeline
# ---------------------------------------------------------------------------

async def run_pipeline(
    session_id: str,
    question_bytes: bytes,
    answer_bytes: bytes,
    progress_callback=None,
) -> ProcessingResult:
    """
    Full extraction + mapping + grading pipeline.
    progress_callback(step: str, percent: int) is called at each stage.
    """

    async def _notify(step: str, pct: int):
        if progress_callback:
            await progress_callback(step, pct)

    await _notify("Converting PDFs to images…", 5)
    question_images = pdf_to_images(question_bytes)
    answer_images = pdf_to_images(answer_bytes)

    if not question_images:
        raise ValueError("Question paper PDF could not be converted or contains 0 pages.")
    if not answer_images:
        raise ValueError("Answer sheet PDF could not be converted or contains 0 pages.")

    await _notify("Extracting questions from question paper…", 20)
    questions = extract_questions(question_images)
    if not questions:
        raise ValueError("No readable questions could be extracted from the question paper.")

    await _notify("Extracting answers from answer sheet…", 50)
    answers = extract_answers(answer_images, questions)

    await _notify("Mapping answers to questions…", 70)
    answers = map_answers_to_questions(questions, answers)

    await _notify("Grading answers with AI…", 80)
    grades = await grade_answers_async(questions, answers, _notify)

    await _notify("Done!", 100)

    return ProcessingResult(
        session_id=session_id,
        questions=questions,
        answers=answers,
        grades=grades,
        total_pages_answer=len(answer_images),
        total_pages_question=len(question_images),
    )

# pyrefly: ignore [missing-import]
from pydantic import BaseModel
from typing import Optional


class BoundingBox(BaseModel):
    """Normalized bounding box coordinates (0.0 to 1.0 relative to page dimensions)."""
    x0: float
    y0: float
    x1: float
    y1: float
    page: int  # 0-indexed page number within the answer sheet


class Question(BaseModel):
    id: str               # e.g. "1", "11a", "11b"
    text: str
    max_marks: int = 0


class Answer(BaseModel):
    question_id: str
    text: str
    bbox: Optional[BoundingBox] = None
    status: str = "answered"  # "answered" | "unanswered" | "unmatched"


class GradingResult(BaseModel):
    question_id: str
    marks_awarded: int
    max_marks: int
    feedback: str
    is_correct: Optional[bool] = None  # True / False / None (partial)


class ProcessingResult(BaseModel):
    session_id: str
    questions: list[Question]
    answers: list[Answer]
    grades: list[GradingResult]
    total_pages_answer: int = 0
    total_pages_question: int = 0


class UploadResponse(BaseModel):
    session_id: str
    message: str


class ProcessingStatus(BaseModel):
    session_id: str
    status: str   # "pending" | "processing" | "done" | "error"
    step: str
    progress: int  # 0-100
    error: Optional[str] = None

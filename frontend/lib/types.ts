export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  page: number;
}

export interface Question {
  id: string;
  text: string;
  max_marks: number;
}

export interface Answer {
  question_id: string;
  text: string;
  bbox: BoundingBox | null;
  status: "answered" | "unanswered" | "unmatched";
}

export interface GradingResult {
  question_id: string;
  marks_awarded: number;
  max_marks: number;
  feedback: string;
  is_correct: boolean | null;
}

export interface ProcessingResult {
  session_id: string;
  questions: Question[];
  answers: Answer[];
  grades: GradingResult[];
  total_pages_answer: number;
  total_pages_question: number;
}

export interface ProcessingStatus {
  session_id: string;
  status: "pending" | "processing" | "done" | "error";
  step: string;
  progress: number;
  error?: string;
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

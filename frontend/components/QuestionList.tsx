"use client";

import { useState } from "react";
import { Question, Answer, GradingResult } from "@/lib/types";
import styles from "./QuestionList.module.css";

interface QuestionListProps {
  questions: Question[];
  answers: Answer[];
  grades: GradingResult[];
  selectedQuestionId: string | null;
  onSelect: (id: string) => void;
}

function getCleanFeedback(feedback?: string, isUnanswered?: boolean): string {
  if (!feedback || !feedback.trim()) {
    return isUnanswered
      ? "Awarded 0 marks: Question was left unanswered by student."
      : "AI feedback not available.";
  }
  // Detect technical error strings / stack traces / JSON error payloads
  const isTechnicalError =
    feedback.includes("Grading error:") ||
    feedback.includes("RESOURCE_EXHAUSTED") ||
    feedback.includes("429") ||
    feedback.includes("503") ||
    feedback.includes("Quota exceeded") ||
    feedback.includes("APIError") ||
    feedback.startsWith("{") ||
    feedback.includes("'error':");

  if (isTechnicalError) {
    return "AI feedback not available.";
  }
  return feedback;
}

export default function QuestionList({
  questions,
  answers,
  grades,
  selectedQuestionId,
  onSelect,
}: QuestionListProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a]));
  const gradeMap = Object.fromEntries(grades.map((g) => [g.question_id, g]));

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={styles.container}>
      {/* Title header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Extracted Questions <span className={styles.titleSub}>(from question paper)</span></h2>
      </div>

      {/* Questions list */}
      <div className={styles.list}>
        {questions.map((q, idx) => {
          const answer = answerMap[q.id];
          const grade = gradeMap[q.id];
          const isSelected = selectedQuestionId === q.id;
          const isExpanded = expanded.has(q.id);
          const awarded = grade?.marks_awarded ?? 0;
          const max = grade?.max_marks ?? q.max_marks ?? 0;
          const isUnanswered = answer?.status === "unanswered";

          const isFullMarks = max > 0 && awarded === max;
          const isZeroMarks = awarded === 0;

          const cleanFeedback = getCleanFeedback(grade?.feedback, isUnanswered);

          return (
            <div
              key={q.id}
              className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
              onClick={() => onSelect(q.id)}
            >
              {/* Top Row: Badge + Score + Chevron */}
              <div className={styles.topRow}>
                {/* Circular dark badge */}
                <div className={`${styles.badge} ${isSelected ? styles.badgeSelected : ""}`}>
                  {idx + 1}
                </div>

                <div className={styles.topRight}>
                  {/* Score pill badge */}
                  <span
                    className={`${styles.scorePill} ${
                      isFullMarks ? styles.scoreGreen : isZeroMarks ? styles.scoreRed : styles.scoreAmber
                    }`}
                  >
                    {awarded}/{max}
                  </span>

                  {/* Chevron Expand button */}
                  <button
                    className={`${styles.chevronBtn} ${isExpanded ? styles.chevronOpen : ""}`}
                    onClick={(e) => toggleExpand(q.id, e)}
                    aria-label="Toggle AI Feedback"
                  >
                    <ChevronIcon />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <p className={styles.questionText}>{q.text}</p>

              {/* AI Feedback Section (Expanded) */}
              {isExpanded && (
                <div className={styles.feedbackCard}>
                  <h4 className={styles.feedbackTitle}>AI Feedback</h4>
                  <p className={styles.feedbackBody}>{cleanFeedback}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

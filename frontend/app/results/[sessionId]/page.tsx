"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import QuestionList from "@/components/QuestionList";
import AnswerSheetViewer from "@/components/AnswerSheetViewer";
import { API_BASE, ProcessingResult, Answer } from "@/lib/types";
import styles from "./results.module.css";

export default function ResultsPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [data, setData] = useState<ProcessingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API_BASE}/api/results/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load results.");
        return r.json();
      })
      .then((d: ProcessingResult) => {
        setData(d);
        // Auto-select first question
        if (d.questions.length > 0) {
          setSelectedQuestionId(d.questions[0].id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Find all answer segments for the selected question
  const selectedAnswers: Answer[] = useMemo(
    () => data?.answers.filter(
      (a) => a.question_id === selectedQuestionId && a.status === "answered" && a.bbox
    ) ?? [],
    [data?.answers, selectedQuestionId]
  );

  // Compute summary totals
  const { totalAwarded, totalMax, answeredCount, totalQuestions } = useMemo(() => ({
    totalAwarded: data?.grades.reduce((s, g) => s + g.marks_awarded, 0) ?? 0,
    totalMax: data?.grades.reduce((s, g) => s + g.max_marks, 0) ?? 0,
    answeredCount: data?.answers.filter((a) => a.status === "answered").length ?? 0,
    totalQuestions: data?.questions.length ?? 0,
  }), [data]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className={styles.backBtn} onClick={() => router.push("/")} aria-label="Go back">
              <BackIcon />
            </button>
            <div className="topbar-breadcrumb">
              <ExamBreadIcon />
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Exams</span>
            </div>
          </div>
          <div className="topbar-right">
            {data && (
              <div className={styles.scoreSummary}>
                <span className={styles.summaryLabel}>Total Score:</span>
                <span className={styles.summaryScore}>
                  {totalAwarded}<span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/{totalMax}</span>
                </span>
                <span className={styles.summaryAttempted}>
                  {answeredCount}/{totalQuestions} attempted
                </span>
              </div>
            )}
            <button className="topbar-icon-btn" aria-label="Help"><HelpIcon /></button>
            <button className="topbar-icon-btn" aria-label="Notifications">
              <BellIcon />
              <span className="notification-dot" />
            </button>
            <button className="topbar-icon-btn" aria-label="AI features"><SparkIcon /></button>
            <div className="user-chip">
              <div className="user-avatar">MR</div>
              <span>Madhur Rastogi</span>
              <ChevronIcon />
            </div>
          </div>
        </header>

        {/* Content */}
        <div className={styles.resultsBody}>
          {loading && (
            <div className={styles.centered}>
              <div className={styles.loadingSpinner} />
              <p className={styles.loadingText}>Loading results…</p>
            </div>
          )}

          {error && (
            <div className={styles.centered}>
              <p className={styles.errorText}>{error}</p>
              <button className={styles.retryBtn} onClick={() => router.push("/")}>
                Back to Upload
              </button>
            </div>
          )}

          {data && !loading && (
            <div className={styles.splitLayout}>
              {/* Left: question list */}
              <div className={styles.leftPanel}>
                <QuestionList
                  questions={data.questions}
                  answers={data.answers}
                  grades={data.grades}
                  selectedQuestionId={selectedQuestionId}
                  onSelect={setSelectedQuestionId}
                />
              </div>

              {/* Right: answer sheet viewer */}
              <div className={styles.rightPanel}>
                <AnswerSheetViewer
                  sessionId={sessionId}
                  totalPages={data.total_pages_answer}
                  selectedAnswers={selectedAnswers}
                  apiBase={API_BASE}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function BackIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
}
function ExamBreadIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>;
}
function HelpIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
}
function SparkIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function ChevronIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>;
}

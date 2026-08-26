"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import { API_BASE } from "@/lib/types";
import styles from "./page.module.css";

export default function UploadPage() {
  const router = useRouter();
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canStart = !!questionFile && !!answerFile && !uploading;

  async function handleStartMapping() {
    if (!questionFile || !answerFile) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("question_paper", questionFile);
      formData.append("answer_sheet", answerFile);

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Upload failed.");
      }

      const { session_id } = await res.json();
      router.push(`/processing/${session_id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setUploading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className={styles.backBtn} aria-label="Go back">
              <BackIcon />
            </button>
            <div className="topbar-breadcrumb">
              <ExamBreadIcon />
              <span>Exams</span>
            </div>
          </div>
          <div className="topbar-right">
            <button className="topbar-icon-btn" aria-label="Help">
              <HelpIcon />
            </button>
            <button className="topbar-icon-btn" aria-label="Notifications">
              <BellIcon />
              <span className="notification-dot" />
            </button>
            <button className="topbar-icon-btn" aria-label="AI features">
              <SparkIcon />
            </button>
            <div className="user-chip">
              <div className="user-avatar">MR</div>
              <span>Madhur Rastogi</span>
              <ChevronIcon />
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="page-body">
          <div className={styles.uploadContainer}>
            {/* Hero heading */}
            <div className={styles.heroSection}>
              <h1 className={styles.heroTitle}>
                Upload{" "}
                <span className={styles.heroHighlight}>
                  Question Paper &amp; Answer Sheets
                </span>
              </h1>
              <p className={styles.heroSubtitle}>Upload both files to get started</p>

              {/* Teacher avatar */}
              <div className={styles.avatarRing}>
                <div className={styles.avatarInner}>
                  <TeacherAvatar />
                </div>
                <span className={styles.ringDot} style={{ "--angle": "30deg" } as React.CSSProperties} />
                <span className={styles.ringDot} style={{ "--angle": "120deg" } as React.CSSProperties} />
                <span className={styles.ringDot} style={{ "--angle": "210deg" } as React.CSSProperties} />
                <span className={styles.ringDot} style={{ "--angle": "300deg" } as React.CSSProperties} />
              </div>
            </div>

            {/* Drop zones */}
            <div className={styles.dropZonesRow}>
              <FileDropZone
                label="Question Paper"
                onFileChange={setQuestionFile}
              />
              <FileDropZone
                label="Answer Sheet"
                onFileChange={setAnswerFile}
              />
            </div>

            {/* Error */}
            {error && (
              <div className={styles.errorBanner} role="alert">
                <AlertIcon /> {error}
              </div>
            )}

            {/* CTA */}
            <div className={styles.ctaSection}>
              <button
                className={`${styles.startBtn} ${canStart ? styles.startBtnActive : ""}`}
                onClick={handleStartMapping}
                disabled={!canStart}
                id="start-mapping-btn"
                aria-label="Start mapping questions to answers"
              >
                {uploading ? (
                  <span className={styles.spinner} />
                ) : (
                  <>
                    Start Mapping
                    <ArrowRightIcon />
                  </>
                )}
              </button>
              <p className={styles.ctaHint}>
                Once both files are uploaded, you&apos;ll be able to map answers with questions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Icons ──────────────────────────────────────────────────────────── */
function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}
function ExamBreadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 9h6M9 12h6M9 15h4"/>
    </svg>
  );
}
function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}
function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}
function TeacherAvatar() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <circle cx="36" cy="36" r="36" fill="#f3e8e0"/>
      {/* Shirt */}
      <ellipse cx="36" cy="58" rx="20" ry="14" fill="#1a1a1a"/>
      {/* Head */}
      <circle cx="36" cy="28" r="14" fill="#f5c5a0"/>
      {/* Hair */}
      <ellipse cx="36" cy="18" rx="14" ry="8" fill="#2d1a0a"/>
      <ellipse cx="36" cy="26" rx="14" ry="4" fill="#2d1a0a"/>
      {/* Glasses */}
      <rect x="26" y="27" width="8" height="5" rx="2" stroke="#555" strokeWidth="1.5" fill="none"/>
      <rect x="38" y="27" width="8" height="5" rx="2" stroke="#555" strokeWidth="1.5" fill="none"/>
      <line x1="34" y1="29.5" x2="38" y2="29.5" stroke="#555" strokeWidth="1.5"/>
    </svg>
  );
}

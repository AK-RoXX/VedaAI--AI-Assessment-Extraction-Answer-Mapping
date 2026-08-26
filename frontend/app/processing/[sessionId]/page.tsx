"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { API_BASE, ProcessingStatus } from "@/lib/types";
import styles from "./processing.module.css";

export default function ProcessingPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const router = useRouter();

  const [status, setStatus] = useState<ProcessingStatus>({
    session_id: sessionId,
    status: "pending",
    step: "Starting extraction pipeline…",
    progress: 5,
  });

  const [displayProgress, setDisplayProgress] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const tickerRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth progress bar interpolator ticker
  useEffect(() => {
    if (status.progress > displayProgress) {
      setDisplayProgress(status.progress);
    }

    // Auto-advance ticker slowly while in a step (prevents bar from looking stuck)
    if (status.status === "processing" && displayProgress < 95) {
      if (tickerRef.current) clearInterval(tickerRef.current);
      tickerRef.current = setInterval(() => {
        setDisplayProgress((prev) => {
          // Limit simulated advance to max +15% past target status progress
          if (prev < Math.min(status.progress + 18, 95)) {
            return prev + 1;
          }
          return prev;
        });
      }, 400);
    }

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [status, displayProgress]);

  useEffect(() => {
    if (!sessionId) return;

    const eventSource = new EventSource(`${API_BASE}/api/process/${sessionId}`);

    eventSource.onmessage = (e) => {
      try {
        const data: ProcessingStatus = JSON.parse(e.data);
        setStatus(data);

        if (data.status === "done") {
          setDisplayProgress(100);
          eventSource.close();
          setTimeout(() => {
            router.push(`/results/${sessionId}`);
          }, 400);
        }

        if (data.status === "error") {
          eventSource.close();
          setError(data.error ?? "An unknown error occurred.");
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setError("Connection to server lost. Please try again.");
    };

    return () => eventSource.close();
  }, [sessionId, router]);

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
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Exams</span>
          </div>
          <div className="topbar-right">
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

        {/* Processing body */}
        <div className="page-body">
          <div className={styles.processingContainer}>
            {error ? (
              <div className={styles.errorState}>
                <div className={styles.errorIcon}>⚠️</div>
                <h2 className={styles.errorTitle}>Something went wrong</h2>
                <p className={styles.errorMsg}>{error}</p>
                <button className={styles.retryBtn} onClick={() => router.push("/")}>
                  Back to Upload
                </button>
              </div>
            ) : (
              <>
                {/* Animated sparkle */}
                <div className={styles.sparkleWrapper} aria-hidden="true">
                  <SparkleCluster />
                </div>

                <h2 className={styles.extractingTitle}>Analyzing &amp; Grading Documents…</h2>
                <p className={styles.extractingSubtitle}>AI is extracting questions, mapping answers, and calculating marks</p>

                {/* Progress bar container */}
                <div className={styles.progressSection}>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${displayProgress}%` }}
                    />
                  </div>
                  <div className={styles.progressStatusRow}>
                    <span className={styles.stepLabel}>{status.step}</span>
                    <span className={styles.percentLabel}>{displayProgress}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sparkle animation ──────────────────────────────────────────── */
function SparkleCluster() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.sparkleSvg}
    >
      <path
        d="M60 10 L67 45 L100 52 L67 59 L60 94 L53 59 L20 52 L53 45 Z"
        fill="#e8500a"
        className={styles.starLarge}
      />
      <path
        d="M28 20 L30 30 L40 32 L30 34 L28 44 L26 34 L16 32 L26 30 Z"
        fill="#f97316"
        className={styles.starSmall1}
      />
      <path
        d="M92 76 L94 86 L104 88 L94 90 L92 100 L90 90 L80 88 L90 86 Z"
        fill="#fb923c"
        className={styles.starSmall2}
      />
      <circle cx="18" cy="62" r="3" fill="#e8500a" className={styles.dot1} />
      <circle cx="100" cy="40" r="3" fill="#f97316" className={styles.dot2} />
      <circle cx="60" cy="108" r="2.5" fill="#e8500a" className={styles.dot3} />
    </svg>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function BackIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
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

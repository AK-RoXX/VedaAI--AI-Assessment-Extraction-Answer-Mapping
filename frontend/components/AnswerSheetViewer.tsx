"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Answer, BoundingBox } from "@/lib/types";
import styles from "./AnswerSheetViewer.module.css";

interface AnswerSheetViewerProps {
  sessionId: string;
  totalPages: number;
  selectedAnswers: Answer[]; // All answer segments for the selected question
  apiBase: string;
}

export default function AnswerSheetViewer({
  sessionId,
  totalPages,
  selectedAnswers,
  apiBase,
}: AnswerSheetViewerProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState<{ w: number; h: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // When selected question changes, jump to page & smoothly center on the answer box
  useEffect(() => {
    if (selectedAnswers.length > 0 && selectedAnswers[0].bbox) {
      const bbox = selectedAnswers[0].bbox;
      const timer = setTimeout(() => {
        setCurrentPage(bbox.page);

        // Auto-focus on the target bounding box rather than throwing view to top (0,0)
        if (imgRef.current && containerRef.current) {
          const containerH = containerRef.current.clientHeight;
          const imgH = imgRef.current.clientHeight;
          const currentZoom = zoom / 100;
          const bboxCenterY = ((bbox.y0 + bbox.y1) / 2) * imgH;
          const targetPanY = (containerH / 2) - (bboxCenterY * currentZoom);
          setPan((prev) => ({ x: prev.x, y: Math.round(targetPanY) }));
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedAnswers, zoom]);

  const imageUrl = `${apiBase}/api/page-image/${sessionId}/answer/${currentPage}`;
  const answersOnPage = selectedAnswers.filter((a) => a.bbox?.page === currentPage);

  const handleImageLoad = useCallback(() => {
    if (imgRef.current) {
      setImgDimensions({
        w: imgRef.current.naturalWidth,
        h: imgRef.current.naturalHeight,
      });
    }
  }, []);

  // Zoom controls
  const zoomIn = () => setZoom((z) => Math.min(z + 25, 300));
  const zoomOut = () => setZoom((z) => Math.max(z - 25, 50));
  const resetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 15 : -15;
      setZoom((z) => Math.min(Math.max(z + delta, 50), 300));
    }
  };

  // Drag / Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch pan support
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      setPan({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

  return (
    <div className={styles.container}>
      {/* Top controls toolbar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>Answer Sheet Viewer</span>
          {selectedAnswers.length > 0 && (
            <span className={styles.activeTag}>
              Viewing Q{selectedAnswers[0].question_id}
            </span>
          )}
        </div>

        {/* Toolbar: zoom + pan reset + page navigation */}
        <div className={styles.headerRight}>
          <div className={styles.controlsGroup}>
            <button className={styles.controlBtn} onClick={zoomOut} title="Zoom out (-)" aria-label="Zoom out">
              <ZoomOutIcon />
            </button>
            <span className={styles.zoomLabel}>{zoom}%</span>
            <button className={styles.controlBtn} onClick={zoomIn} title="Zoom in (+)" aria-label="Zoom in">
              <ZoomInIcon />
            </button>
            <button className={styles.resetBtn} onClick={resetZoom} title="Reset Zoom & Position">
              Reset
            </button>
          </div>

          <div className={styles.pageNav}>
            <button
              className={styles.navBtn}
              onClick={() => {
                setCurrentPage((p) => Math.max(p - 1, 0));
                setPan({ x: 0, y: 0 });
              }}
              disabled={currentPage === 0}
              title="Previous page"
              aria-label="Previous page"
            >
              <PrevIcon />
            </button>
            <span className={styles.pageLabel}>
              Page <strong>{currentPage + 1}</strong> of {totalPages}
            </span>
            <button
              className={styles.navBtn}
              onClick={() => {
                setCurrentPage((p) => Math.min(p + 1, totalPages - 1));
                setPan({ x: 0, y: 0 });
              }}
              disabled={currentPage >= totalPages - 1}
              title="Next page"
              aria-label="Next page"
            >
              <NextIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Main interactive canvas viewport */}
      <div
        ref={containerRef}
        className={`${styles.viewport} ${isDragging ? styles.isDragging : ""}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className={styles.pageWrapper}
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`,
            transformOrigin: "center center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt={`Answer sheet page ${currentPage + 1}`}
            className={styles.pageImage}
            onLoad={handleImageLoad}
            key={imageUrl}
            draggable={false}
          />

          {/* Bounding box highlight overlays */}
          {imgDimensions &&
            answersOnPage.map((answer, i) => (
              <BBoxHighlight
                key={i}
                bbox={answer.bbox!}
                label={`Q${answer.question_id}`}
              />
            ))}
        </div>
      </div>

      {/* Bottom thumbnail page dots */}
      {totalPages > 1 && (
        <div className={styles.footerDots}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === currentPage ? styles.dotActive : ""}`}
              onClick={() => {
                setCurrentPage(i);
                setPan({ x: 0, y: 0 });
              }}
              title={`Jump to Page ${i + 1}`}
              aria-label={`Go to page ${i + 1}`}
            >
              Page {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Bounding box highlight overlay ─────────────────────────────── */
interface BBoxHighlightProps {
  bbox: BoundingBox;
  label: string;
}

function BBoxHighlight({ bbox, label }: BBoxHighlightProps) {
  const left = `${bbox.x0 * 100}%`;
  const top = `${bbox.y0 * 100}%`;
  const width = `${(bbox.x1 - bbox.x0) * 100}%`;
  const height = `${(bbox.y1 - bbox.y0) * 100}%`;

  return (
    <div
      className={styles.highlight}
      style={{ left, top, width, height }}
      aria-label={`Answer region for ${label}`}
    >
      <div className={styles.highlightHeader}>
        <span className={styles.highlightLabel}>{label}</span>
      </div>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function ZoomInIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

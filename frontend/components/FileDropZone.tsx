"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./FileDropZone.module.css";

interface FileInfo {
  name: string;
  size: number;
  pages?: number;
}

interface FileDropZoneProps {
  label: string;
  accept?: string;
  maxSizeBytes?: number;
  onFileChange: (file: File | null) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropZone({
  label,
  accept = ".pdf,image/*",
  maxSizeBytes = 10 * 1024 * 1024,
  onFileChange,
}: FileDropZoneProps) {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.size > maxSizeBytes) {
        setError(`File exceeds ${formatSize(maxSizeBytes)} limit.`);
        return;
      }
      setError(null);
      setFileInfo({ name: file.name, size: file.size });
      onFileChange(file);
    },
    [maxSizeBytes, onFileChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFileInfo(null);
    setError(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ""} ${fileInfo ? styles.hasFile : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !fileInfo && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && !fileInfo && inputRef.current?.click()}
      aria-label={`Upload ${label}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        id={`file-input-${label.replace(/\s+/g, "-").toLowerCase()}`}
      />

      {!fileInfo ? (
        <div className={styles.placeholder}>
          <div className={styles.uploadIcon}>
            <UploadIcon />
          </div>
          <p className={styles.uploadLabel}>
            Upload <span className={styles.accent}>{label}</span>
          </p>
          <p className={styles.uploadHint}>Max {formatSize(maxSizeBytes)}</p>
        </div>
      ) : (
        <div className={styles.fileCard}>
          <div className={styles.pdfIcon}>
            <PdfIcon />
          </div>
          <div className={styles.fileDetails}>
            <span className={styles.fileName}>{fileInfo.name}</span>
            <span className={styles.fileMeta}>{formatSize(fileInfo.size)}</span>
          </div>
          <button
            className={styles.removeBtn}
            onClick={handleRemove}
            aria-label="Remove file"
            id={`remove-${label.replace(/\s+/g, "-").toLowerCase()}`}
          >
            <CloseIcon />
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="1" width="14" height="18" rx="2" fill="#ef4444" opacity="0.15"/>
      <rect x="3" y="1" width="14" height="18" rx="2" stroke="#ef4444" strokeWidth="1.5"/>
      <path d="M14 1l3 3" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="14" y="1" width="3" height="3" rx="0.5" fill="#ef4444" opacity="0.5"/>
      <text x="5" y="14" fontSize="5" fontWeight="700" fill="#ef4444" fontFamily="Inter,sans-serif">PDF</text>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./PlexUploadModal.module.css";
import PrimaryButton from "./PrimaryButton";
import { FaCloudUploadAlt } from "react-icons/fa";

import * as driveService from "@/src/lib/driveService";

export default function PlexUploadModal({ isOpen, onClose, userId }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const resetAndClose = useCallback(() => {
    setSelectedFile(null);
    setIsDragOver(false);
    setUploading(false);
    setUploadProgress(0);
    setUploadResult(null);
    setUploadError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") resetAndClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, resetAndClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) resetAndClose();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setUploadProgress(0);
    try {
      const result = await driveService.plexUpload(
        userId,
        selectedFile,
        (pct) => {
          setUploadProgress(pct);
        },
      );
      setUploadResult(result);
    } catch (err) {
      setUploadError(driveService.getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Upload Video to Plex"
      >
        <h2 className={styles.modalTitle}>Upload Video to Plex</h2>

        <div
          className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ""}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <FaCloudUploadAlt className={styles.uploadIcon} />
          <p className={styles.dropText}>Drag and drop a video file here</p>
          <p className={styles.orText}>or</p>
          <PrimaryButton onClick={handleBrowseClick}>Browse</PrimaryButton>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className={styles.hiddenInput}
            tabIndex={-1}
          />
        </div>

        {selectedFile && <p className={styles.fileName}>{selectedFile.name}</p>}

        {uploading && (
          <div className={styles.uploadProgressContainer}>
            <div
              className={styles.uploadProgressBar}
              style={{ width: `${uploadProgress}%` }}
            />
            <span className={styles.uploadProgressText}>
              Uploading… {uploadProgress}%
            </span>
          </div>
        )}

        {uploadResult && (
          <div className={styles.fileName}>
            <p>
              Uploaded: {uploadResult.fileName} ({uploadResult.size})
            </p>
          </div>
        )}

        {uploadError && (
          <p className={styles.fileName} style={{ color: "#ff4444" }}>
            {uploadError}
          </p>
        )}

        <div className={styles.buttonRow}>
          {selectedFile && !uploadResult && (
            <PrimaryButton onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload"}
            </PrimaryButton>
          )}
          <PrimaryButton onClick={resetAndClose}>Close</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

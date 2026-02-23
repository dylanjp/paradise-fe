"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./PlexUploadModal.module.css";
import PrimaryButton from "./PrimaryButton";
import { FaCloudUploadAlt } from "react-icons/fa";

export default function PlexUploadModal({ isOpen, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const resetAndClose = useCallback(() => {
    setSelectedFile(null);
    setIsDragOver(false);
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
    if (file) setSelectedFile(file);
  };

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Upload Video to Plex">
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

        {selectedFile && (
          <p className={styles.fileName}>{selectedFile.name}</p>
        )}

        <div className={styles.buttonRow}>
          <PrimaryButton onClick={resetAndClose}>Close</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

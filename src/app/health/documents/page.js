"use client";

/**
 * Health Documents Screen
 * Upload, categorize, filter, download, and delete health documents.
 * Supports drag-and-drop and click-to-browse file upload with inline category selection.
 * Provides category filtering, CSV export, and delete confirmation.
 *
 * Requirements: 5.1–5.8, 6.1–6.3, 12.4
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useHealth } from "@/src/context/HealthContext";
import TCard from "@/components/TCard";
import TButton from "@/components/TButton";
import HealthModal from "@/components/HealthModal";
import { DOC_CATEGORIES } from "@/utils/healthConstants";
import { formatShortDate } from "@/utils/dateFormatter";
import { exportDocumentsCSV, triggerDownload } from "@/utils/csvExporter";
import styles from "./documents.module.css";

export default function DocumentsPage() {
  const {
    documents,
    documentsLoading,
    documentsError,
    fetchDocuments,
    uploadDocument,
    deleteDocument,
  } = useHealth();

  // State
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [uploadCategory, setUploadCategory] = useState("Other");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Filtered documents based on selected category
  const filteredDocuments = useMemo(() => {
    if (selectedCategory === null) return documents;
    return documents.filter((doc) => doc.category === selectedCategory);
  }, [documents, selectedCategory]);

  // --- Upload handlers ---

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleUploadKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await doUpload(file);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (file) {
      await doUpload(file);
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function doUpload(file) {
    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocument(file, uploadCategory);
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // --- Category filter handlers ---

  function handleFilterClick(category) {
    setSelectedCategory((prev) => (prev === category ? null : category));
  }

  function handleFilterAll() {
    setSelectedCategory(null);
  }

  // --- Document actions ---

  function handleDownload(doc) {
    const link = document.createElement("a");
    link.href = doc.url;
    link.download = doc.name;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleDeleteClick(doc) {
    setDeleteTarget(doc);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      // Error is set in context
    } finally {
      setDeleting(false);
    }
  }

  // --- Export ---

  function handleExport() {
    const csv = exportDocumentsCSV(documents);
    triggerDownload(csv, "health_documents.csv");
  }

  // --- Helpers ---

  function getCategoryInfo(categoryLabel) {
    return DOC_CATEGORIES.find((c) => c.label === categoryLabel) || DOC_CATEGORIES[6];
  }

  // --- Render ---

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>HEALTH DOCUMENTS</h1>
        {documents.length > 0 && (
          <TButton variant="secondary" onClick={handleExport} ariaLabel="Export all documents as CSV">
            ⬇ EXPORT ALL
          </TButton>
        )}
      </div>

      {/* Error banners */}
      {documentsError && (
        <div className={styles.errorBanner} role="alert">
          {documentsError}
        </div>
      )}
      {uploadError && (
        <div className={styles.errorBanner} role="alert">
          Upload failed: {uploadError}
        </div>
      )}

      {/* Upload Zone */}
      <div
        className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Upload health document"
        onClick={handleUploadClick}
        onKeyDown={handleUploadKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-hidden="true"
          tabIndex={-1}
        />
        <p className={styles.uploadText}>
          {uploading
            ? "Uploading..."
            : "Drag & drop a file here, or click to browse"}
        </p>

        {/* Inline category selector */}
        <div
          className={styles.categorySelector}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {DOC_CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              type="button"
              className={`${styles.categorySelectorBtn} ${
                uploadCategory === cat.label ? styles.categorySelectorBtnActive : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setUploadCategory(cat.label);
              }}
              aria-pressed={uploadCategory === cat.label}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className={styles.filterBar} role="group" aria-label="Filter by category">
        <button
          type="button"
          className={`${styles.filterBtn} ${selectedCategory === null ? styles.filterBtnActive : ""}`}
          onClick={handleFilterAll}
          aria-pressed={selectedCategory === null}
        >
          All
        </button>
        {DOC_CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            type="button"
            className={`${styles.filterBtn} ${
              selectedCategory === cat.label ? styles.filterBtnActive : ""
            }`}
            onClick={() => handleFilterClick(cat.label)}
            aria-pressed={selectedCategory === cat.label}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {documentsLoading && (
        <p className={styles.loading}>Loading documents...</p>
      )}

      {/* Empty state */}
      {!documentsLoading && filteredDocuments.length === 0 && (
        <p className={styles.emptyState}>
          {selectedCategory
            ? `No documents in "${selectedCategory}" category.`
            : "No documents uploaded yet. Use the upload zone above to add your first document."}
        </p>
      )}

      {/* Document List */}
      {!documentsLoading && filteredDocuments.length > 0 && (
        <div className={styles.docList}>
          {filteredDocuments.map((doc) => {
            const catInfo = getCategoryInfo(doc.category);

            return (
              <TCard key={doc.id}>
                <div className={styles.docRow}>
                  <div className={styles.docInfo}>
                    <span className={styles.docName}>{doc.name}</span>
                    <span className={styles.docMeta}>
                      <span
                        className={styles.categoryBadge}
                        style={{
                          background: `${catInfo.color}18`,
                          color: catInfo.color,
                        }}
                      >
                        {catInfo.icon} {doc.category}
                      </span>
                      {" · "}
                      {formatShortDate(doc.date)}
                      {" · "}
                      {doc.size}
                    </span>
                  </div>
                  <div className={styles.docActions}>
                    <TButton
                      variant="ghost"
                      onClick={() => handleDownload(doc)}
                      ariaLabel={`Download ${doc.name}`}
                    >
                      ⬇
                    </TButton>
                    <TButton
                      variant="danger"
                      onClick={() => handleDeleteClick(doc)}
                      ariaLabel={`Delete ${doc.name}`}
                    >
                      ✕
                    </TButton>
                  </div>
                </div>
              </TCard>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <HealthModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
      >
        <p>
          Are you sure you want to delete{" "}
          <strong>{deleteTarget ? deleteTarget.name : ""}</strong>? This action
          cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeleteTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>
    </div>
  );
}

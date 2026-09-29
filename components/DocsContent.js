"use client";

import { useRef, useEffect } from "react";
import { FaDownload, FaExternalLinkAlt, FaFileImage } from "react-icons/fa";
import DocsMarkdownView from "./DocsMarkdownView";
import DocsCanvasView from "./DocsCanvasView";
import PdfViewer from "./PdfViewer";
import ImageViewer from "./ImageViewer";
import {
  allowsOpenInNewTab,
  getExtension,
  openBlobInNewTab,
  saveBlobAs,
} from "@/src/lib/fileTypes";
import styles from "./DocsContent.module.css";

/** Last path segment */
function fileNameOf(path) {
  const clean = String(path ?? "");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/** Image doc: name, Download / Open in new tab, and the fit/1:1 viewer */
function DocsImageView({ doc }) {
  const name = fileNameOf(doc.path);
  const ext = getExtension(doc.path);
  const canOpenInTab = !!doc.blob && allowsOpenInNewTab("image", ext);

  return (
    <div className={styles.viewerContainer}>
      <div className={styles.fileToolbar} role="toolbar" aria-label="Image actions">
        <span className={styles.fileName} title={name}>
          <FaFileImage className={styles.fileIcon} aria-hidden="true" />
          {name}
        </span>
        <div className={styles.fileActions}>
          {canOpenInTab && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => openBlobInNewTab(doc.blob, ext)}
            >
              <FaExternalLinkAlt aria-hidden="true" />
              <span>Open in new tab</span>
            </button>
          )}
          <button
            type="button"
            className={styles.actionButton}
            onClick={() => doc.blob && saveBlobAs(doc.blob, name)}
            disabled={!doc.blob}
          >
            <FaDownload aria-hidden="true" />
            <span>Download</span>
          </button>
        </div>
      </div>
      <div className={styles.imageArea}>
        <ImageViewer url={doc.displayUrl} alt={name} />
      </div>
    </div>
  );
}

/**
 * DocsContent - Shows the selected document, dispatching on its kind:
 * markdown (decode animation + embeds), canvas, PDF or image.
 * The empty, loading and error states are shared by every kind.
 *
 * @param {object|null} doc - Loaded document from useDocumentation
 *   ({path, kind, text | blob + displayUrl, cache, error})
 * @param {string|null} selectedPath - Currently selected file path
 * @param {object} index - Docs index (buildDocsIndex) for link resolution
 * @param {function} onSelectFile - Callback to navigate to a linked document
 */
export default function DocsContent({ doc, selectedPath, index, onSelectFile }) {
  const contentRef = useRef(null);

  // Scroll to top when a new file is selected
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [selectedPath]);

  // Empty state - no file selected
  if (!selectedPath) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#9776;</div>
          <p className={styles.emptyText}>SELECT A DOCUMENT FROM THE SIDEBAR</p>
          <p className={styles.emptySubtext}>
            Browse the file tree to view documentation
          </p>
        </div>
      </div>
    );
  }

  // Loading state (also while the previous doc is still in state)
  if (!doc || doc.path !== selectedPath) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.loadingState}>
          <span className={styles.loadingText}>DECRYPTING FILE...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (doc.error) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>ACCESS DENIED</p>
          <p className={styles.errorMessage}>{doc.error}</p>
        </div>
      </div>
    );
  }

  switch (doc.kind) {
    case "markdown":
      return (
        <div className={styles.contentArea} ref={contentRef}>
          <main className={styles.markdownContainer}>
            <DocsMarkdownView
              key={doc.path}
              path={doc.path}
              text={doc.text}
              index={index}
              cache={doc.cache}
              onSelectFile={onSelectFile}
              scrollRef={contentRef}
            />
          </main>
        </div>
      );

    case "canvas":
      return (
        <div
          className={`${styles.contentArea} ${styles.canvasArea}`}
          ref={contentRef}
        >
          <DocsCanvasView
            key={doc.path}
            path={doc.path}
            text={doc.text}
            index={index}
            cache={doc.cache}
            onSelectFile={onSelectFile}
          />
        </div>
      );

    case "pdf":
      return (
        <div className={styles.contentArea} ref={contentRef}>
          <div className={styles.viewerContainer}>
            <PdfViewer
              key={doc.path}
              blob={doc.blob}
              url={doc.displayUrl}
              fileName={fileNameOf(doc.path)}
            />
          </div>
        </div>
      );

    case "image":
      return (
        <div className={styles.contentArea} ref={contentRef}>
          <DocsImageView key={doc.path} doc={doc} />
        </div>
      );

    default:
      return (
        <div className={styles.contentArea} ref={contentRef}>
          <div className={styles.errorState}>
            <p className={styles.errorTitle}>UNSUPPORTED FILE</p>
            <p className={styles.errorMessage}>
              This file type can&apos;t be previewed.
            </p>
          </div>
        </div>
      );
  }
}

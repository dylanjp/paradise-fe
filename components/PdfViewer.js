"use client";

import { useSyncExternalStore } from "react";
import { FaDownload, FaExternalLinkAlt, FaFilePdf } from "react-icons/fa";
import {
  allowsOpenInNewTab,
  openBlobInNewTab,
  saveBlobAs,
} from "@/src/lib/fileTypes";
import styles from "./PdfViewer.module.css";

/**
 * Whether the browser can show PDFs inline (false on most phones).
 * Browsers that predate navigator.pdfViewerEnabled (undefined) are desktop
 * browsers with a built-in viewer, so only an explicit false falls back.
 */
function detectPdfSupport() {
  if (typeof navigator === "undefined") return true;
  return navigator.pdfViewerEnabled !== false;
}

/** The capability never changes while the page is open */
function subscribeNoop() {
  return () => {};
}

/** Server/prerender snapshot: assume support (the client re-checks on hydration) */
function serverPdfSupport() {
  return true;
}

/**
 * PdfViewer - Shows a PDF with the browser's built-in viewer.
 * Falls back to a download notice where inline PDFs aren't supported.
 *
 * @param {Blob} blob - PDF contents (used for Download / Open in new tab)
 * @param {string} url - Display URL for the iframe. Must come from
 *   blobToDisplayUrl(blob, "pdf") so the blob is retyped application/pdf (a blob
 *   typed text/html in a same-origin iframe would run script).
 * @param {string} fileName - Name used for downloads and the iframe title
 * @param {boolean} toolbar - Show the Download / Open in new tab toolbar (default true)
 */
export default function PdfViewer({ blob, url, fileName, toolbar = true }) {
  // useSyncExternalStore keeps static-export hydration consistent: the prerender
  // uses serverPdfSupport, the client uses the real navigator check
  const pdfSupported = useSyncExternalStore(
    subscribeNoop,
    detectPdfSupport,
    serverPdfSupport,
  );
  const name = fileName || "document.pdf";
  const canOpenInTab = !!blob && allowsOpenInNewTab("pdf", "pdf");

  const handleDownload = () => {
    if (blob) saveBlobAs(blob, name);
  };

  const handleOpenInTab = () => {
    if (blob) openBlobInNewTab(blob, "pdf");
  };

  return (
    <div className={styles.pdfViewer}>
      {toolbar && (
        <div className={styles.toolbar} role="toolbar" aria-label="PDF actions">
          <span className={styles.fileName} title={name}>
            <FaFilePdf className={styles.fileIcon} aria-hidden="true" />
            {name}
          </span>
          <div className={styles.actions}>
            {canOpenInTab && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleOpenInTab}
              >
                <FaExternalLinkAlt aria-hidden="true" />
                <span>Open in new tab</span>
              </button>
            )}
            <button
              type="button"
              className={styles.actionButton}
              onClick={handleDownload}
              disabled={!blob}
            >
              <FaDownload aria-hidden="true" />
              <span>Download</span>
            </button>
          </div>
        </div>
      )}

      {pdfSupported && url ? (
        <iframe className={styles.frame} src={url} title={name} />
      ) : (
        <div className={styles.notice}>
          <FaFilePdf className={styles.noticeIcon} aria-hidden="true" />
          <p className={styles.noticeTitle}>
            Preview not supported on this device
          </p>
          <p className={styles.noticeText}>
            Download the PDF to view it in another app.
          </p>
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleDownload}
            disabled={!blob}
          >
            <FaDownload aria-hidden="true" />
            <span>Download</span>
          </button>
        </div>
      )}
    </div>
  );
}

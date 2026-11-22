"use client";

import { useSyncExternalStore } from "react";
import { FaDownload, FaExternalLinkAlt, FaFilePdf } from "react-icons/fa";
import {
  allowsOpenInNewTab,
  openBlobInNewTab,
  saveBlobAs,
} from "@/src/lib/fileTypes";
import { hasInlinePdfViewer } from "@/src/lib/pdfCanvas";
import PdfCanvasViewer from "./PdfCanvasViewer";
import styles from "./PdfViewer.module.css";

/** The capability never changes while the page is open */
function subscribeNoop() {
  return () => {};
}

/** Server/prerender snapshot: assume support (the client re-checks on hydration) */
function serverPdfSupport() {
  return true;
}

/**
 * PdfViewer - Shows a PDF with the browser's built-in viewer, or draws its pages
 * with pdf.js where the browser has none (phones and tablets).
 *
 * @param {Blob} blob - PDF contents (used for drawing, Download and Open in new tab)
 * @param {string} url - Display URL for the iframe. Must come from
 *   blobToDisplayUrl(blob, "pdf") so the blob is retyped application/pdf (a blob
 *   typed text/html in a same-origin iframe would run script).
 * @param {string} fileName - Name used for downloads and the iframe title
 * @param {boolean} toolbar - Show the Download / Open in new tab toolbar (default true)
 */
export default function PdfViewer({ blob, url, fileName, toolbar = true }) {
  // useSyncExternalStore keeps static-export hydration consistent: the prerender
  // uses serverPdfSupport, the client uses the real check
  const inlineViewer = useSyncExternalStore(
    subscribeNoop,
    hasInlinePdfViewer,
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

  let body;
  if (inlineViewer && url) {
    body = <iframe className={styles.frame} src={url} title={name} />;
  } else if (blob) {
    body = (
      <PdfCanvasViewer
        blob={blob}
        fileName={name}
        onDownload={handleDownload}
      />
    );
  } else {
    body = (
      <div className={styles.notice}>
        <FaFilePdf className={styles.noticeIcon} aria-hidden="true" />
        <p className={styles.noticeTitle}>Preview not available</p>
        <p className={styles.noticeText}>The PDF hasn&apos;t loaded.</p>
      </div>
    );
  }

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

      {body}
    </div>
  );
}

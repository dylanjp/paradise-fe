"use client";

import { useEffect, useRef, useState } from "react";
import {
  FaDownload,
  FaFilePdf,
  FaSearchMinus,
  FaSearchPlus,
} from "react-icons/fa";
import { mountPdfPages, PDF_ZOOM_STEPS } from "@/src/lib/pdfCanvas";
import styles from "./PdfCanvasViewer.module.css";

/** Message for a PDF that pdf.js could not open */
function errorMessage(error) {
  if (error && error.name === "PasswordException") {
    return "This PDF is password-protected.";
  }
  return "This PDF couldn't be displayed.";
}

/**
 * PdfCanvasViewer - Draws a PDF's pages in the page with pdf.js, for devices
 * whose browser can't show PDFs in a frame (phones and tablets).
 * Scrolls vertically; the zoom buttons widen the pages past the box for detail.
 *
 * @param {Blob} blob - PDF contents
 * @param {string} fileName - Shown in labels
 * @param {Function} onDownload - Saves the PDF (offered when it can't be drawn)
 */
export default function PdfCanvasViewer({ blob, fileName, onDownload }) {
  const scrollRef = useRef(null);
  const handleRef = useRef(null);
  const [state, setState] = useState({ status: "loading", blob });
  const [zoomIndex, setZoomIndex] = useState(0);
  const zoom = PDF_ZOOM_STEPS[zoomIndex];
  const zoomRef = useRef(zoom);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !blob) return undefined;
    const handle = mountPdfPages(el, blob, {
      zoom: zoomRef.current,
      onStatus: (next) => setState({ ...next, blob }),
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      if (handleRef.current === handle) handleRef.current = null;
    };
  }, [blob]);

  useEffect(() => {
    zoomRef.current = zoom;
    if (handleRef.current) handleRef.current.setZoom(zoom);
  }, [zoom]);

  // A status left over from the previous blob reads as loading
  const status = state.blob === blob ? state.status : "loading";
  const name = fileName || "document.pdf";

  return (
    <div className={styles.viewer}>
      <div
        ref={scrollRef}
        className={styles.pages}
        tabIndex={0}
        role="region"
        aria-label={`${name}, ${state.pages || 0} page${state.pages === 1 ? "" : "s"}`}
        aria-busy={status === "loading"}
      />

      {status === "loading" && (
        <div className={styles.overlay} role="status">
          <FaFilePdf className={styles.overlayIcon} aria-hidden="true" />
          <p className={styles.overlayText}>Loading PDF…</p>
        </div>
      )}

      {status === "error" && (
        <div className={styles.overlay} role="alert">
          <FaFilePdf className={styles.overlayIcon} aria-hidden="true" />
          <p className={styles.overlayTitle}>{errorMessage(state.error)}</p>
          <p className={styles.overlayText}>
            Download it to open it in another app.
          </p>
          <button
            type="button"
            className={styles.button}
            onClick={onDownload}
          >
            <FaDownload aria-hidden="true" />
            <span>Download</span>
          </button>
        </div>
      )}

      {status === "ready" && (
        <div className={styles.zoomBar} role="group" aria-label="Zoom">
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex === 0}
            aria-label="Zoom out"
          >
            <FaSearchMinus aria-hidden="true" />
          </button>
          <span className={styles.zoomLevel} aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className={styles.zoomButton}
            onClick={() =>
              setZoomIndex((i) => Math.min(PDF_ZOOM_STEPS.length - 1, i + 1))
            }
            disabled={zoomIndex === PDF_ZOOM_STEPS.length - 1}
            aria-label="Zoom in"
          >
            <FaSearchPlus aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

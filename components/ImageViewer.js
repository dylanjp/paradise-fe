"use client";

import { useState } from "react";
import styles from "./ImageViewer.module.css";

/**
 * ImageViewer - Displays one image, fitted to its container.
 * Clicking toggles between "fit" and actual size (1:1); at actual size the
 * container scrolls. In fit mode the image height is capped by the CSS variable
 * --image-viewer-max-height (default 80vh), which containers may override.
 *
 * @param {string} url - Display URL (object URL, or data: URL for SVG)
 * @param {string} alt - Alternative text
 */
export default function ImageViewer({ url, alt = "" }) {
  // Tied to the URL so a new image always starts fitted and error-free
  const [state, setState] = useState({ url, actualSize: false, failed: false });
  const current =
    state.url === url ? state : { url, actualSize: false, failed: false };

  if (!url || current.failed) {
    return (
      <div className={styles.viewport}>
        <p className={styles.error}>IMAGE FAILED TO LOAD</p>
      </div>
    );
  }

  return (
    <div
      className={`${styles.viewport} ${current.actualSize ? styles.scrollable : ""}`}
    >
      <button
        type="button"
        className={`${styles.imageButton} ${
          current.actualSize ? styles.actualSizeButton : styles.fitButton
        }`}
        onClick={() =>
          setState({ ...current, actualSize: !current.actualSize })
        }
        aria-pressed={current.actualSize}
        title={current.actualSize ? "Click to fit" : "Click for actual size"}
      >
        <img
          src={url}
          alt={alt}
          draggable={false}
          decoding="async"
          className={current.actualSize ? styles.actualSize : styles.fit}
          onError={() => setState({ ...current, failed: true })}
        />
      </button>
    </div>
  );
}

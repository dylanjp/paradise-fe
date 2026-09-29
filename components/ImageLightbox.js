"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";
import ImageViewer from "./ImageViewer";
import styles from "./ImageLightbox.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * ImageLightbox - Full-screen overlay for one image (e.g. an embedded doc image).
 * Escape, the close button or a click on the backdrop closes it. Focus moves into
 * the dialog, is trapped there, and returns to the previously focused element.
 * Rendered in a portal on document.body so transformed ancestors (the canvas
 * view) can't offset the fixed overlay.
 *
 * @param {string} url - Display URL of the image
 * @param {string} alt - Alternative text (also used as the dialog label)
 * @param {function} onClose - Called to close the lightbox
 */
export default function ImageLightbox({ url, alt = "", onClose }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  // A drag that starts on the image and ends on the backdrop must not close
  const pressedOnBackdropRef = useRef(false);

  // Remember and restore focus; lock page scroll while open
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        requestAnimationFrame(() => previouslyFocused.focus());
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }

      // Focus trap: Tab / Shift+Tab cycle inside the dialog
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Capture phase, so Escape closes only the lightbox and never reaches a
  // modal or page handler underneath it (stopPropagation above)
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  if (typeof document === "undefined") return null;

  // Anything outside the image and the header counts as the backdrop
  const isBackdrop = (target) =>
    !!target &&
    typeof target.closest === "function" &&
    !target.closest("button") &&
    !target.closest("[data-lightbox-header]");

  // React events bubble through portals along the React tree, so without this a
  // click or drag in the lightbox would reach the component that opened it (e.g.
  // the canvas view's pan handlers or the docs click delegation)
  const stopReactPropagation = (e) => e.stopPropagation();

  const handleOverlayMouseDown = (e) => {
    e.stopPropagation();
    pressedOnBackdropRef.current = isBackdrop(e.target);
  };

  // A click that both started and ended on the backdrop closes
  const handleOverlayClick = (e) => {
    e.stopPropagation();
    const pressedOnBackdrop = pressedOnBackdropRef.current;
    pressedOnBackdropRef.current = false;
    if (pressedOnBackdrop && isBackdrop(e.target)) onClose?.();
  };

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      onDoubleClick={stopReactPropagation}
      onPointerDown={stopReactPropagation}
      onPointerMove={stopReactPropagation}
      onPointerUp={stopReactPropagation}
      onPointerCancel={stopReactPropagation}
      onTouchStart={stopReactPropagation}
      onTouchMove={stopReactPropagation}
      onTouchEnd={stopReactPropagation}
      onWheel={stopReactPropagation}
      onKeyDown={stopReactPropagation}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={alt || "Image preview"}
      >
        <div className={styles.header} data-lightbox-header="">
          <span className={styles.caption} title={alt}>
            {alt}
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={() => onClose?.()}
            aria-label="Close image preview"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>
          <ImageViewer url={url} alt={alt} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

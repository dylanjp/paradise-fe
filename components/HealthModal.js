"use client";
import { useEffect, useRef, useCallback } from "react";
import styles from "./HealthModal.module.css";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Overlay dialog with backdrop blur, animated entry, and focus trapping.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Controls visibility
 * @param {function} props.onClose - Called on Escape key or overlay click
 * @param {string} props.title - Modal title
 * @param {React.ReactNode} props.children - Modal body content
 */
export default function HealthModal({ isOpen, onClose, title, children }) {
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Capture the previously focused element when modal opens
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Focus the first focusable element inside the modal on open
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const focusableElements = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      // If no focusable children, focus the panel itself
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Return focus to previously focused element on close
  useEffect(() => {
    if (!isOpen && previousFocusRef.current) {
      const el = previousFocusRef.current;
      previousFocusRef.current = null;
      // Use requestAnimationFrame to ensure DOM has settled
      requestAnimationFrame(() => {
        if (el && typeof el.focus === "function") {
          el.focus();
        }
      });
    }
  }, [isOpen]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      // Focus trap: Tab / Shift+Tab cycling
      if (e.key === "Tab" && panelRef.current) {
        const focusableElements = panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR);
        if (focusableElements.length === 0) {
          e.preventDefault();
          return;
        }

        const firstEl = focusableElements[0];
        const lastEl = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift+Tab: if focus is on first element, wrap to last
          if (document.activeElement === firstEl) {
            e.preventDefault();
            lastEl.focus();
          }
        } else {
          // Tab: if focus is on last element, wrap to first
          if (document.activeElement === lastEl) {
            e.preventDefault();
            firstEl.focus();
          }
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

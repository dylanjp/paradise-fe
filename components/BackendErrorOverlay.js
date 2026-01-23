"use client";
import styles from "./BackendErrorOverlay.module.css";

/**
 * Error overlay component for backend down state
 * @param {Object} props
 * @param {boolean} props.isRetrying - Whether a retry is in progress
 * @param {Function} props.onRetry - Callback when retry button is clicked
 */
export default function BackendErrorOverlay({ isRetrying, onRetry }) {
  return (
    <div className={styles.overlay} role="alert" aria-live="assertive">
      <div className={styles.content}>
        <p className={styles.errorMessage}>
          The Server is down. Please contact the Administrator.
        </p>
        <button
          className={styles.retryButton}
          onClick={onRetry}
          disabled={isRetrying}
          aria-disabled={isRetrying}
        >
          {isRetrying ? "Retrying..." : "Retry"}
        </button>
      </div>
    </div>
  );
}

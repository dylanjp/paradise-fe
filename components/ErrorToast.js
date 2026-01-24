/**
 * ErrorToast Component
 * Toast-style error display component with TRON styling.
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import styles from './ErrorToast.module.css';

const DEFAULT_DURATION = 5000;

export default function ErrorToast({ toast, onDismiss }) {
  const { id, message, type, duration = DEFAULT_DURATION } = toast;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const handleDismiss = useCallback(() => {
    onDismiss(id);
  }, [id, onDismiss]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDismiss();
    }
  }, [handleDismiss]);

  const typeClass = type === 'success' 
    ? styles.success 
    : type === 'warning' 
      ? styles.warning 
      : styles.error;

  return (
    <div 
      className={`${styles.toast} ${typeClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.content}>
        <span className={styles.icon}>
          {type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕'}
        </span>
        <p className={styles.message}>{message}</p>
      </div>
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        onKeyDown={handleKeyDown}
        aria-label="Dismiss notification"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

/**
 * ToastContainer Component
 * Container for managing and displaying multiple toast notifications.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import ErrorToast from './ErrorToast';
import styles from './ToastContainer.module.css';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children, maxToasts = 5 }) {
  const [toasts, setToasts] = useState([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const showToast = useCallback((message, type = 'error', duration) => {
    const newToast = { id: generateId(), message, type, duration };
    setToasts(prev => {
      const updated = [...prev, newToast];
      if (updated.length > maxToasts) return updated.slice(-maxToasts);
      return updated;
    });
  }, [generateId, maxToasts]);

  const showError = useCallback((message, duration) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const showSuccess = useCallback((message, duration) => {
    showToast(message, 'success', duration ?? 3000);
  }, [showToast]);

  const showWarning = useCallback((message, duration) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => setToasts([]), []);

  const contextValue = useMemo(() => ({
    showToast,
    showError,
    showSuccess,
    showWarning,
    dismissToast,
    clearAllToasts,
  }), [showToast, showError, showSuccess, showWarning, dismissToast, clearAllToasts]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <div className={styles.container} aria-label="Notifications">
          {toasts.map(toast => (
            <ErrorToast
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
            />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export default ToastProvider;

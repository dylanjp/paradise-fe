"use client";
import { useEffect, useCallback } from "react";
import styles from "./ConfirmModal.module.css";

export default function ConfirmModal({
  isOpen,
  itemName,
  onConfirm,
  onCancel,
  title = "Confirm Delete",
  message,
  confirmLabel = "Delete",
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onCancel();
  };

  const defaultMessage = (
    <>
      Are you sure you want to delete{" "}
      <span className={styles.itemName}>{itemName}</span>?
    </>
  );

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={styles.modalTitle}>{title}</h2>
        <p className={styles.message}>{message || defaultMessage}</p>
        <div className={styles.buttonRow}>
          <button className={styles.deleteButton} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className={styles.cancelButton} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

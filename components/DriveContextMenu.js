"use client";
import { useEffect, useRef } from "react";
import styles from "./DriveContextMenu.module.css";

export default function DriveContextMenu({
  x,
  y,
  itemType,
  onChangeColor,
  onDelete,
  onDownload,
  onMove,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Context menu"
    >
      {itemType === "folder" && (
        <button
          className={styles.menuItem}
          onClick={(e) => {
            e.stopPropagation();
            onChangeColor();
          }}
          role="menuitem"
        >
          Change Color
        </button>
      )}
      {itemType === "folder" && <div className={styles.separator} />}
      {itemType === "file" && onDownload && (
        <>
          <button
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            role="menuitem"
          >
            Download
          </button>
          <div className={styles.separator} />
        </>
      )}
      {onMove && (
        <>
          <button
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            role="menuitem"
          >
            Move
          </button>
          <div className={styles.separator} />
        </>
      )}
      <button
        className={`${styles.menuItem} ${styles.deleteItem}`}
        onClick={onDelete}
        role="menuitem"
      >
        Delete
      </button>
    </div>
  );
}

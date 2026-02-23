"use client";
import { useEffect, useRef } from "react";
import styles from "./DriveContextMenu.module.css";

export default function DriveContextMenu({ x, y, itemType, onChangeColor, onDelete, onClose }) {
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
          onClick={onChangeColor}
          role="menuitem"
        >
          Change Color
        </button>
      )}
      {itemType === "folder" && <div className={styles.separator} />}
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

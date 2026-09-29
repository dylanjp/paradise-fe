"use client";
import { useEffect } from "react";
import styles from "./DriveContextMenu.module.css";
import useViewportPosition from "@/src/lib/useViewportPosition";

/**
 * DriveContextMenu - Right-click menu for a drive item.
 * Files get Preview (only when onPreview is given, i.e. the file is previewable)
 * and Download; folders get Change Color. Move and Delete apply to both.
 */
export default function DriveContextMenu({
  x,
  y,
  itemType,
  onChangeColor,
  onDelete,
  onPreview,
  onDownload,
  onMove,
  onClose,
}) {
  const [menuRef, position] = useViewportPosition(x, y);

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
  }, [onClose, menuRef]);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: position.left, top: position.top }}
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
      {itemType === "file" && (onPreview || onDownload) && (
        <>
          {onPreview && (
            <button
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              role="menuitem"
            >
              Preview
            </button>
          )}
          {onDownload && (
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
          )}
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

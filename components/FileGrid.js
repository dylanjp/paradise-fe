"use client";
import { useRef, useEffect } from "react";
import styles from "./FileGrid.module.css";
import DriveItemCard from "./DriveItemCard";
import { FaFolder } from "react-icons/fa";

export default function FileGrid({
  items,
  onFolderClick,
  onFileClick,
  onContextMenu,
  newFolderMode,
  onNewFolderSubmit,
  onNewFolderCancel,
  isMediaCache = false,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (newFolderMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [newFolderMode]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      const name = e.target.value.trim();
      if (name) {
        onNewFolderSubmit(name);
      } else {
        onNewFolderCancel();
      }
    } else if (e.key === "Escape") {
      onNewFolderCancel();
    }
  };

  const handleBlur = (e) => {
    const name = e.target.value.trim();
    if (name) {
      onNewFolderSubmit(name);
    } else {
      onNewFolderCancel();
    }
  };

  const showNewFolder = newFolderMode && !isMediaCache;

  if (!showNewFolder && items.length === 0) {
    return <div className={styles.emptyState}>This folder is empty</div>;
  }

  return (
    <div className={styles.grid}>
      {showNewFolder && (
        <div className={styles.newFolderCard}>
          <FaFolder className={styles.newFolderIcon} />
          <input
            ref={inputRef}
            className={styles.newFolderInput}
            type="text"
            placeholder="Folder name"
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            aria-label="New folder name"
          />
        </div>
      )}
      {items.map((item) => (
        <DriveItemCard
          key={item.id}
          item={item}
          onClick={
            item.type === "folder"
              ? () => onFolderClick(item.id)
              : onFileClick
                ? () => onFileClick(item.id)
                : undefined
          }
          onContextMenu={(e) => onContextMenu(e, item.id)}
        />
      ))}
    </div>
  );
}

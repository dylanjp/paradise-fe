"use client";
import styles from "./DriveItemCard.module.css";
import { getIconForType } from "@/src/lib/driveUtils";

export default function DriveItemCard({
  item,
  onClick,
  onContextMenu,
  draggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver = false,
  isDragging = false,
}) {
  const { icon: IconComponent, color } = getIconForType(
    item.type,
    item.fileType,
  );
  const iconColor = item.type === "folder" && item.color ? item.color : color;

  const handleClick = () => {
    if (onClick) onClick();
  };

  const handleContextMenu = (e) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(e);
    }
  };

  let className = styles.card;
  if (isDragging) className += ` ${styles.dragging}`;
  if (isDragOver) className += ` ${styles.dragOver}`;

  return (
    <div
      className={className}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      aria-label={`${item.name}${item.size ? `, ${item.size}` : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={styles.iconWrapper}>
        <IconComponent className={styles.icon} style={{ color: iconColor }} />
      </div>
      <span className={styles.name}>{item.name}</span>
      {item.type === "file" && item.size && (
        <span className={styles.size}>{item.size}</span>
      )}
    </div>
  );
}

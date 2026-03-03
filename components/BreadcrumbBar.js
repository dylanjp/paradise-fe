"use client";
import styles from "./BreadcrumbBar.module.css";

export default function BreadcrumbBar({
  path,
  onNavigate,
  onSegmentDragOver,
  onSegmentDragLeave,
  onSegmentDrop,
  dragOverSegmentId = null,
  isMediaCache = false,
  moveMode = null,
  onMoveTarget,
}) {
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;
        const isDragOver = dragOverSegmentId === segment.id;
        const isMoveTarget = moveMode && !isLast;
        const segmentClass = isDragOver || isMoveTarget
          ? `${styles.segment} ${styles.dragOver}`
          : styles.segment;
        const currentClass = isDragOver
          ? `${styles.current} ${styles.dragOver}`
          : styles.current;

        const dragHandlers =
          !isMediaCache && !isLast
            ? {
                onDragOver: (e) => {
                  e.preventDefault();
                  if (onSegmentDragOver) onSegmentDragOver(e, segment.id);
                },
                onDragLeave: (e) => {
                  if (onSegmentDragLeave) onSegmentDragLeave(e);
                },
                onDrop: (e) => {
                  e.preventDefault();
                  if (onSegmentDrop) onSegmentDrop(e, segment.id, segment.name);
                },
              }
            : {};

        const handleClick = () => {
          if (isMoveTarget && onMoveTarget) {
            onMoveTarget(segment.id, segment.name);
          } else {
            onNavigate(segment.id);
          }
        };

        return (
          <span key={segment.id} className={styles.segmentWrapper}>
            {index > 0 && <span className={styles.separator}>{" > "}</span>}
            {isLast ? (
              <span className={currentClass} aria-current="page" {...dragHandlers}>
                {segment.name}
              </span>
            ) : (
              <button
                className={segmentClass}
                onClick={handleClick}
                type="button"
                {...dragHandlers}
              >
                {segment.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

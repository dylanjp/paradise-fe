"use client";
import styles from "./BreadcrumbBar.module.css";

export default function BreadcrumbBar({ path, onNavigate }) {
  return (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;
        return (
          <span key={segment.id} className={styles.segmentWrapper}>
            {index > 0 && <span className={styles.separator}>{" > "}</span>}
            {isLast ? (
              <span className={styles.current} aria-current="page">
                {segment.name}
              </span>
            ) : (
              <button
                className={styles.segment}
                onClick={() => onNavigate(segment.id)}
                type="button"
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

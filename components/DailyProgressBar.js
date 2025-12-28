import React from "react";
import styles from "./DailyProgressBar.module.css";

const DailyProgressBar = ({
  percentage = 0,
  className = "",
  onClick,
  isClickable = true,
}) => {
  // Robustly convert input to a number between 0 and 100
  // Number() handles strings, || 0 handles NaN/null/undefined
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));

  const isComplete = safePercentage === 100;
  const canClick = isClickable && onClick;

  const handleClick = () => {
    if (canClick) {
      onClick();
    }
  };

  const handleKeyDown = (e) => {
    if (canClick && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`${styles.progressContainer} ${className} ${isComplete ? styles.neonGlow : ""} ${canClick ? styles.clickable : ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      aria-label={
        canClick
          ? `Daily progress: ${safePercentage}%. Click to open daily tasks`
          : undefined
      }
    >
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${safePercentage}%` }}
          role="progressbar"
          aria-valuenow={safePercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily progress: ${safePercentage}%`}
        />
      </div>
      <div className={styles.progressText}>
        Daily Progress: {safePercentage}%
      </div>
    </div>
  );
};

export default DailyProgressBar;

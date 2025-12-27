import React from 'react';
import styles from './DailyProgressBar.module.css';

const DailyProgressBar = ({ percentage = 0, className = '' }) => {
  // Robustly convert input to a number between 0 and 100
  // Number() handles strings, || 0 handles NaN/null/undefined
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
  
  const isComplete = safePercentage === 100;

  return (
    <div className={`${styles.progressContainer} ${className} ${isComplete ? styles.neonGlow : ''}`}>
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
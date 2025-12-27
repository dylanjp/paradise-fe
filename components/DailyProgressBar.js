import React from 'react';
import { validateProgressPercentage, validateComponentProps } from '../src/lib/taskStateValidation';
import styles from './DailyProgressBar.module.css';

const DailyProgressBar = ({ percentage = 0, className = '' }) => {
  // Validate props
  const propsValidation = validateComponentProps(
    { percentage, className },
    ['percentage']
  );

  if (!propsValidation.isValid) {
    console.error('DailyProgressBar props validation failed:', propsValidation.errors);
    return (
      <div className={`${styles.progressContainer} ${styles.errorContainer} ${className}`}>
        <div className={styles.errorText}>Progress bar configuration error</div>
      </div>
    );
  }

  // Validate and clamp percentage
  const progressValidation = validateProgressPercentage(percentage);
  if (!progressValidation.isValid) {
    console.warn('DailyProgressBar percentage validation issues:', progressValidation.errors);
  }

  const clampedPercentage = progressValidation.value;
  const isComplete = clampedPercentage === 100;

  return (
    <div className={`${styles.progressContainer} ${className} ${isComplete ? styles.neonGlow : ''}`}>
      <div className={styles.progressBar}>
        <div 
          className={styles.progressFill}
          style={{ width: `${clampedPercentage}%` }}
          role="progressbar"
          aria-valuenow={clampedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Daily progress: ${clampedPercentage}%`}
        />
      </div>
      <div className={styles.progressText}>
        Daily Progress: {clampedPercentage}%
      </div>
    </div>
  );
};

export default DailyProgressBar;
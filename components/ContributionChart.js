'use client';

import { useState, useMemo } from 'react';
import { generateYearDays, groupByWeek, generateMonthLabels } from '../src/lib/chartUtils';
import styles from './ContributionChart.module.css';

/**
 * Individual day square in the contribution chart
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {boolean} isCompleted - Whether the task was completed on this day
 */
const DaySquare = ({ date, isCompleted }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div
      className={`${styles.daySquare} ${isCompleted ? styles.completed : styles.empty}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      aria-label={`${formattedDate}: ${isCompleted ? 'Completed' : 'Not completed'}`}
      role="gridcell"
    >
      {showTooltip && (
        <div className={styles.tooltip}>
          <span className={styles.tooltipDate}>{formattedDate}</span>
          <span className={isCompleted ? styles.tooltipCompleted : styles.tooltipIncomplete}>
            {isCompleted ? '✓ Completed' : 'Not completed'}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * GitHub-style contribution chart showing daily completions
 * @param {number} year - Year to display
 * @param {Set<string>|string[]} completionDates - Set or array of ISO date strings that have completions
 */
const ContributionChart = ({ year, completionDates = [] }) => {
  // Convert to Set for fast lookup if array is passed
  const completionSet = useMemo(() => {
    if (completionDates instanceof Set) {
      return completionDates;
    }
    return new Set(completionDates);
  }, [completionDates]);

  // Generate all days for the year
  const days = useMemo(() => generateYearDays(year), [year]);

  // Group days by week for grid layout
  const weeks = useMemo(() => groupByWeek(days), [days]);

  // Generate month labels with positions
  const monthLabels = useMemo(() => generateMonthLabels(year), [year]);

  // Total weeks for percentage-based positioning
  const totalWeeks = weeks.length;

  return (
    <div className={styles.chartContainer}>
      {/* Month labels row */}
      <div className={styles.monthLabelsRow}>
        <div className={styles.dayLabelsPlaceholder}></div>
        <div className={styles.monthLabels}>
          {monthLabels.map(({ month, weekIndex }) => (
            <span
              key={month}
              className={styles.monthLabel}
              style={{ left: `${(weekIndex / totalWeeks) * 100}%` }}
            >
              {month}
            </span>
          ))}
        </div>
      </div>

      {/* Chart grid with day labels */}
      <div className={styles.chartGrid}>
        {/* Day of week labels */}
        <div className={styles.dayLabels}>
          <span className={styles.dayLabel}></span>
          <span className={styles.dayLabel}>Mon</span>
          <span className={styles.dayLabel}></span>
          <span className={styles.dayLabel}>Wed</span>
          <span className={styles.dayLabel}></span>
          <span className={styles.dayLabel}>Fri</span>
          <span className={styles.dayLabel}></span>
        </div>

        {/* Weeks container */}
        <div className={styles.weeksContainer} role="grid" aria-label={`Contribution chart for ${year}`}>
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className={styles.week} role="row">
              {week.map((day, dayIndex) => (
                day ? (
                  <DaySquare
                    key={day.date}
                    date={day.date}
                    isCompleted={completionSet.has(day.date)}
                  />
                ) : (
                  <div key={`empty-${dayIndex}`} className={styles.emptySquare} role="gridcell" />
                )
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        <div className={`${styles.legendSquare} ${styles.empty}`}></div>
        <div className={`${styles.legendSquare} ${styles.completed}`}></div>
        <span className={styles.legendLabel}>More</span>
      </div>
    </div>
  );
};

export default ContributionChart;

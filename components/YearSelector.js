"use client";
import React from "react";
import styles from "./YearSelector.module.css";

/**
 * Dropdown for selecting a year to view
 * @param {number[]} years - Array of available years
 * @param {number} selected - Currently selected year
 * @param {function} onSelect - Callback when selection changes
 */
const YearSelector = ({ years = [], selected, onSelect }) => {
  // Hide if only one year available or no years
  if (years.length <= 1) {
    return null;
  }

  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label} htmlFor="year-selector">
        Year
      </label>
      <select
        id="year-selector"
        className={styles.dropdown}
        value={selected}
        onChange={(e) => onSelect?.(parseInt(e.target.value, 10))}
        aria-label="Select a year"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  );
};

export default YearSelector;

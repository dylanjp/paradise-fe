"use client";
import React from "react";
import styles from "./TaskSelector.module.css";

/**
 * Dropdown for selecting a daily task
 * Includes "All Perfect Days" option to return to perfect days view
 * @param {Array} tasks - Array of daily task objects
 * @param {string} selectedId - Currently selected task ID
 * @param {function} onSelect - Callback when selection changes
 */
const TaskSelector = ({ tasks = [], selectedId, onSelect }) => {
  /**
   * Handle selection change
   * When empty value is selected, clears selection to return to perfect days view
   * Requirements: 4.1, 4.2, 4.3
   */
  const handleChange = (e) => {
    const value = e.target.value;
    // Pass null when clearing selection to trigger perfect days view
    onSelect?.(value || null);
  };

  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label} htmlFor="task-selector">
        Select Task
      </label>
      <select
        id="task-selector"
        className={styles.dropdown}
        value={selectedId || ""}
        onChange={handleChange}
        aria-label="Select a daily task"
      >
        <option value="">All Perfect Days</option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.description}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TaskSelector;

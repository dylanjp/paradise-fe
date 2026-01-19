"use client";
import React from "react";
import styles from "./TaskSelector.module.css";

/**
 * Dropdown for selecting a daily task
 * @param {Array} tasks - Array of daily task objects
 * @param {string} selectedId - Currently selected task ID
 * @param {function} onSelect - Callback when selection changes
 */
const TaskSelector = ({ tasks = [], selectedId, onSelect }) => {
  return (
    <div className={styles.selectorContainer}>
      <label className={styles.label} htmlFor="task-selector">
        Select Task
      </label>
      <select
        id="task-selector"
        className={styles.dropdown}
        value={selectedId || ""}
        onChange={(e) => onSelect?.(e.target.value || null)}
        aria-label="Select a daily task"
      >
        <option value="">-- Select a task --</option>
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

import React, { useState, useRef, useEffect } from "react";
import styles from "./DailyTasksModal.module.css";

/**
 * DailyTasksModal - Modal component for displaying and managing daily tasks
 *
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler to close modal
 * @param {Array} tasks - List of daily tasks
 * @param {function} onToggleTask - Handler to toggle task completion
 * @param {function} onAddTask - Handler to add new task
 */
const DailyTasksModal = ({
  isOpen,
  onClose,
  tasks = [],
  onToggleTask,
  onAddTask,
}) => {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Focus input when adding task mode is activated
  useEffect(() => {
    if (isAddingTask && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAddingTask]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        if (isAddingTask) {
          setIsAddingTask(false);
          setNewTaskDescription("");
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isAddingTask, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle add task button click
  const handleAddTaskClick = () => {
    setIsAddingTask(true);
  };

  // Handle save new task
  const handleSaveTask = () => {
    const trimmed = newTaskDescription.trim();
    if (trimmed) {
      onAddTask(trimmed);
    }
    setNewTaskDescription("");
    setIsAddingTask(false);
  };

  // Handle input key down
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSaveTask();
    } else if (e.key === "Escape") {
      setNewTaskDescription("");
      setIsAddingTask(false);
    }
  };

  // Handle task toggle
  const handleToggle = (taskId) => {
    onToggleTask(taskId);
  };

  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div
      className={styles.modalOverlay}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-tasks-title"
    >
      <div className={styles.modal} ref={modalRef}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 id="daily-tasks-title" className={styles.modalTitle}>
            Daily Tasks
          </h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Task List */}
        <div className={styles.taskList}>
          {sortedTasks.length === 0 ? (
            <div className={styles.emptyState}>
              No daily tasks yet. Add one to get started!
            </div>
          ) : (
            sortedTasks.map((task) => (
              <div key={task.id} className={styles.dailyTaskRow}>
                <input
                  type="checkbox"
                  className={`${styles.taskCheckbox} ${task.completed ? styles.completedCheckbox : ""}`}
                  checked={task.completed}
                  onChange={() => handleToggle(task.id)}
                  aria-label={`Mark "${task.description}" as ${task.completed ? "incomplete" : "complete"}`}
                />
                <span
                  className={`${styles.taskText} ${task.completed ? styles.completedText : ""}`}
                >
                  {task.description}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Add Task Input (shown when adding) */}
        {isAddingTask && (
          <input
            ref={inputRef}
            type="text"
            className={styles.addTaskInput}
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            onBlur={handleSaveTask}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter task description..."
            aria-label="New task description"
          />
        )}

        {/* Button Container */}
        <div className={styles.buttonContainer}>
          <button
            className={styles.addTaskButton}
            onClick={handleAddTaskClick}
            disabled={isAddingTask}
          >
            + Add Daily Task
          </button>
          <button
            className={styles.dashboardButton}
            disabled
            title="Coming soon"
            aria-label="Dashboard (coming soon)"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyTasksModal;

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import styles from "./DailyTasksModal.module.css";

/**
 * SortableDailyTaskRow - A sortable wrapper for daily task rows
 */
const SortableDailyTaskRow = ({ task, onToggle, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.dailyTaskRow} ${isDragging ? styles.dragging : ""}`}
    >
      <span
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        ⋮⋮
      </span>
      <input
        type="checkbox"
        className={`${styles.taskCheckbox} ${task.completed ? styles.completedCheckbox : ""}`}
        checked={task.completed}
        onChange={() => onToggle(task.id)}
        aria-label={`Mark "${task.description}" as ${task.completed ? "incomplete" : "complete"}`}
      />
      <span
        className={`${styles.taskText} ${task.completed ? styles.completedText : ""}`}
      >
        {task.description}
      </span>
      <button
        className={styles.deleteButton}
        onClick={() => onDelete(task.id)}
        aria-label={`Delete task: ${task.description}`}
        type="button"
      >
        ✕
      </button>
    </div>
  );
};

/**
 * DailyTaskRowOverlay - Non-interactive task row for drag overlay
 */
const DailyTaskRowOverlay = ({ task }) => {
  return (
    <div className={`${styles.dailyTaskRow} ${styles.dragOverlay}`}>
      <span className={styles.dragHandle}>⋮⋮</span>
      <input
        type="checkbox"
        className={`${styles.taskCheckbox} ${task.completed ? styles.completedCheckbox : ""}`}
        checked={task.completed}
        readOnly
      />
      <span
        className={`${styles.taskText} ${task.completed ? styles.completedText : ""}`}
      >
        {task.description}
      </span>
      <button className={styles.deleteButton} type="button">
        ✕
      </button>
    </div>
  );
};

/**
 * DailyTasksModal - Modal component for displaying and managing daily tasks
 *
 * @param {boolean} isOpen - Controls modal visibility
 * @param {function} onClose - Handler to close modal
 * @param {Array} tasks - List of daily tasks
 * @param {function} onToggleTask - Handler to toggle task completion
 * @param {function} onAddTask - Handler to add new task
 * @param {function} onDeleteTask - Handler to delete a task
 * @param {function} onReorderTasks - Handler to reorder tasks via drag-and-drop
 */
const DailyTasksModal = ({
  isOpen,
  onClose,
  tasks = [],
  onToggleTask,
  onAddTask,
  onDeleteTask,
  onReorderTasks,
}) => {
  const router = useRouter();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [activeId, setActiveId] = useState(null);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Configuration for various input types (matching TaskContainer)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  // Handle drag end for reordering tasks
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Sort tasks by order for consistent indexing
    const currentSortedTasks = [...tasks].sort((a, b) => a.order - b.order);
    
    const oldIndex = currentSortedTasks.findIndex((t) => t.id === active.id);
    const newIndex = currentSortedTasks.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate new task order using arrayMove
    const reorderedTasks = arrayMove(currentSortedTasks, oldIndex, newIndex);

    // Update order values for all tasks
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      order: index + 1,
    }));

    // Call the reorder handler if provided
    if (onReorderTasks) {
      onReorderTasks(updatedTasks);
    }
  };

  // Handle dashboard navigation
  const handleDashboardClick = () => {
    onClose();
    router.push("/tasks/dashboard");
  };

  // Sort tasks by order
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  // Get the active task for drag overlay
  const activeTask = activeId ? sortedTasks.find((t) => t.id === activeId) : null;

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => setActiveId(e.active.id)}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortedTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {sortedTasks.map((task) => (
                  <SortableDailyTaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggle}
                    onDelete={onDeleteTask}
                  />
                ))}
              </SortableContext>

              <DragOverlay>
                {activeTask ? <DailyTaskRowOverlay task={activeTask} /> : null}
              </DragOverlay>
            </DndContext>
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
            onClick={handleDashboardClick}
            aria-label="View Dashboard"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyTasksModal;

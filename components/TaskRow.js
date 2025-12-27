import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { validateTask, validateComponentProps } from '../src/lib/taskStateValidation';
import styles from './TaskRow.module.css';

const TaskRow = ({ 
  task, 
  onComplete, 
  onRename,
  isSection = false, 
  indentLevel = 0, 
  isEditing = false,
  isNewTask = false,
  className = '' 
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isEditingLocal, setIsEditingLocal] = useState(isEditing || isNewTask);
  const [editValue, setEditValue] = useState(task?.description || '');
  const inputRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task?.id || 'default',
    disabled: isRemoving || hasError || isEditingLocal
  });

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingLocal && inputRef.current) {
      inputRef.current.focus();
      if (isNewTask) {
        inputRef.current.select();
      }
    }
  }, [isEditingLocal, isNewTask]);

  // Validate props
  const propsValidation = validateComponentProps(
    { task, onComplete, className },
    ['task']
  );

  if (!propsValidation.isValid) {
    console.error('TaskRow props validation failed:', propsValidation.errors);
    return (
      <div className={`${styles.taskRow} ${styles.errorRow} ${className}`}>
        <span className={styles.errorText}>Invalid task data</span>
      </div>
    );
  }

  // Validate task object (skip validation for new tasks)
  if (!isNewTask && !validateTask(task)) {
    console.error('TaskRow received invalid task:', task);
    return (
      <div className={`${styles.taskRow} ${styles.errorRow} ${className}`}>
        <span className={styles.errorText}>
          Malformed task: {task?.description || 'Unknown task'}
        </span>
      </div>
    );
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCheckboxChange = () => {
    try {
      if (onComplete && task && !isRemoving && !hasError && !isNewTask) {
        setIsRemoving(true);
        // Delay the actual removal to allow animation to play
        setTimeout(() => {
          try {
            onComplete(task.id);
          } catch (error) {
            console.error('TaskRow: Error during task completion callback:', error);
            setHasError(true);
            setIsRemoving(false);
          }
        }, 300); // Match animation duration
      }
    } catch (error) {
      console.error('TaskRow: Error during checkbox change:', error);
      setHasError(true);
    }
  };

  const handleTextClick = () => {
    if (!isNewTask && !isEditingLocal && !isRemoving && !hasError) {
      setIsEditingLocal(true);
      setEditValue(task.description || '');
    }
  };

  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleInputBlur = () => {
    handleSave();
  };

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && onRename) {
      try {
        onRename(task.id, trimmedValue);
        setIsEditingLocal(false);
      } catch (error) {
        console.error('TaskRow: Error during rename:', error);
        setHasError(true);
      }
    } else if (!trimmedValue && isNewTask) {
      // Cancel new task creation if empty
      handleCancel();
    } else {
      // Revert to original value if empty for existing tasks
      setEditValue(task.description || '');
      setIsEditingLocal(false);
    }
  };

  const handleCancel = () => {
    if (isNewTask && onComplete) {
      // Remove the new task if cancelled
      onComplete(task.id);
    } else {
      setEditValue(task.description || '');
      setIsEditingLocal(false);
    }
  };

  // Ensure task description is safe to display
  const safeDescription = task?.description && typeof task.description === 'string' 
    ? task.description.trim() 
    : (isNewTask ? 'New Task' : 'Untitled Task');

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`${styles.taskRow} ${isSection ? styles.sectionRow : ''} ${indentLevel > 0 ? styles.childRow : ''} ${isDragging ? styles.dragging : ''} ${isRemoving ? styles.removing : ''} ${hasError ? styles.errorRow : ''} ${isEditingLocal ? styles.editing : ''} ${isNewTask ? styles.newTask : ''} ${className}`}
      data-indent-level={indentLevel}
    >
      <div 
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder task"
        style={{ opacity: isEditingLocal ? 0.3 : 1 }}
      >
        ⋮⋮
      </div>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={task?.completed || false}
        onChange={handleCheckboxChange}
        disabled={isRemoving || hasError || isNewTask}
        aria-label={`Mark "${safeDescription}" as complete`}
        style={{ opacity: isNewTask ? 0.3 : 1 }}
      />
      {isEditingLocal ? (
        <input
          ref={inputRef}
          type="text"
          className={`${styles.taskInput} ${isSection ? styles.sectionInput : ''}`}
          value={editValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          placeholder={isSection ? "Section name..." : "Task description..."}
          aria-label={isNewTask ? "Enter new task description" : "Edit task description"}
        />
      ) : (
        <span 
          className={`${styles.taskText} ${isSection ? styles.sectionText : ''} ${styles.clickableText}`}
          onClick={handleTextClick}
          title="Click to edit"
        >
          {isSection ? safeDescription.toUpperCase() : safeDescription}
        </span>
      )}
      {hasError && (
        <span className={styles.errorIndicator} title="Task error occurred">
          ⚠
        </span>
      )}
    </div>
  );
};

export default TaskRow;
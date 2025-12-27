import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './TaskRow.module.css';

const TaskRow = ({ 
  task, 
  onComplete, 
  onRename,
  isSection = false, 
  indentLevel = 0, 
  isNewTask = false,
  className = '',
  isOverlay = false // Added to handle the DragOverlay look
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [isEditing, setIsEditing] = useState(isNewTask);
  const [editValue, setEditValue] = useState(task?.description ?? '');
  const inputRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: task?.id ?? 'temp-id',
    disabled: isRemoving || isEditing || isOverlay
  });

  // Focus management for editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (isNewTask) inputRef.current.select();
    }
  }, [isEditing, isNewTask]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleComplete = () => {
    if (!task?.id || isRemoving) return;
    setIsRemoving(true);
    // Smooth exit: wait for CSS animation (300ms) before removing from state
    setTimeout(() => onComplete(task.id), 300);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.description) {
      onRename(task.id, trimmed);
    } else if (!trimmed && isNewTask) {
      onComplete(task.id); // Remove if new task is empty
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(task.description);
      setIsEditing(false);
      if (isNewTask) onComplete(task.id);
    }
  };

  // Safe fallback for rendering
  if (!task && !isOverlay) return null;

  const displayDescription = isSection ? editValue.toUpperCase() : editValue;

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`
        ${styles.taskRow} 
        ${isSection ? styles.sectionRow : ''} 
        ${indentLevel > 0 ? styles.childRow : ''} 
        ${isRemoving ? styles.removing : ''} 
        ${isEditing ? styles.editing : ''} 
        ${className}
      `.trim()}
    >
      <div 
        className={styles.dragHandle} 
        {...attributes} 
        {...listeners}
        style={{ cursor: isEditing ? 'default' : 'grab' }}
      >
        ⋮⋮
      </div>

      <input
        type="checkbox"
        className={styles.checkbox}
        checked={task?.completed ?? false}
        onChange={handleComplete}
        disabled={isNewTask || isRemoving}
      />

      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.taskInput}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Task name..."
        />
      ) : (
        <span 
          className={`${styles.taskText} ${styles.clickableText}`}
          onClick={() => !isRemoving && setIsEditing(true)}
        >
          {displayDescription || "Untitled Task"}
        </span>
      )}
    </div>
  );
};

export default TaskRow;
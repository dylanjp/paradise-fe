import React from 'react';
import styles from './AddTaskButtons.module.css';

const AddTaskButtons = ({ 
  onAddTask, 
  className = '' 
}) => {
  const handleAddTask = () => {
    if (onAddTask) {
      onAddTask();
    }
  };

  return (
    <div className={`${styles.addButtonsContainer} ${className}`}>
      <button 
        className={styles.addButton}
        onClick={handleAddTask}
        type="button"
        aria-label="Add new task"
      >
        + ADD TASK
      </button>
    </div>
  );
};

export default AddTaskButtons;
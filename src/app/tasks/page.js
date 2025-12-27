"use client";
import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import DailyProgressBar from "@/components/DailyProgressBar";
import TaskToggle from "@/components/TaskToggle";
import TaskContainer from "@/components/TaskContainer";
import ErrorBoundary from "@/components/ErrorBoundary";
import { 
  validateTaskArray, 
  validateCategory, 
  sanitizeTaskArray,
  createSafeStateUpdater,
  validateProgressPercentage,
  handleMalformedTaskData,
  createLoadingHandler,
  handleEmptyState
} from "../../lib/taskStateValidation";
import styles from "./tasks.module.css";

// Enhanced task data structure with hierarchical support
const INITIAL_TASKS = {
  personal: [
    { id: '1', description: 'Review morning routine', category: 'personal', completed: false, order: 1, createdAt: new Date('2024-01-01') },
    { id: '2', description: 'HEALTH & FITNESS', category: 'personal', completed: false, order: 2, createdAt: new Date('2024-01-01') }, // Section
    { id: '3', description: 'Go for morning walk', category: 'personal', completed: false, order: 1, parentId: '2', createdAt: new Date('2024-01-01') },
    { id: '4', description: 'Drink 8 glasses of water', category: 'personal', completed: false, order: 2, parentId: '2', createdAt: new Date('2024-01-01') },
    { id: '5', description: 'Call family members', category: 'personal', completed: false, order: 3, createdAt: new Date('2024-01-01') },
    { id: '6', description: 'WEEKEND PLANNING', category: 'personal', completed: false, order: 4, createdAt: new Date('2024-01-01') }, // Section
    { id: '7', description: 'Research local events', category: 'personal', completed: false, order: 1, parentId: '6', createdAt: new Date('2024-01-01') },
    { id: '8', description: 'Plan grocery shopping', category: 'personal', completed: false, order: 2, parentId: '6', createdAt: new Date('2024-01-01') }
  ],
  work: [
    { id: '9', description: 'Complete project documentation', category: 'work', completed: false, order: 1, createdAt: new Date('2024-01-01') },
    { id: '10', description: 'CODE REVIEW TASKS', category: 'work', completed: false, order: 2, createdAt: new Date('2024-01-01') }, // Section
    { id: '11', description: 'Review pull request #123', category: 'work', completed: false, order: 1, parentId: '10', createdAt: new Date('2024-01-01') },
    { id: '12', description: 'Test new feature branch', category: 'work', completed: false, order: 2, parentId: '10', createdAt: new Date('2024-01-01') },
    { id: '13', description: 'Attend team standup meeting', category: 'work', completed: false, order: 3, createdAt: new Date('2024-01-01') },
    { id: '14', description: 'Update project timeline', category: 'work', completed: false, order: 4, createdAt: new Date('2024-01-01') }
  ]
};

// Helper functions for hierarchical task relationships
const isSection = (task, allTasks) => {
  return allTasks.some(t => t.parentId === task.id);
};

const getChildTasks = (parentId, allTasks) => {
  return allTasks.filter(t => t.parentId === parentId);
};

const getRootTasks = (allTasks) => {
  return allTasks.filter(t => !t.parentId);
};

const getTaskHierarchy = (allTasks) => {
  const rootTasks = getRootTasks(allTasks);
  const result = [];
  
  rootTasks.forEach(rootTask => {
    result.push(rootTask);
    const children = getChildTasks(rootTask.id, allTasks);
    children.sort((a, b) => a.order - b.order);
    result.push(...children);
  });
  
  return result;
};

// Hardcoded daily progress percentage
const DAILY_PROGRESS = 77;

// Task ID counter for generating new task IDs
let NEXT_TASK_ID = 15;

// Helper function to generate unique task ID
const generateTaskId = () => {
  return String(NEXT_TASK_ID++);
};

export default function TasksPage() {
  // Error state for handling validation failures
  const [errors, setErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Error handler for state validation failures
  const handleStateError = useCallback((message, details) => {
    console.error(message, details);
    setErrors(prev => [...prev, { message, details, timestamp: new Date() }]);
  }, []);

  // Loading handler for async operations
  const loadingHandler = createLoadingHandler(setIsLoading, handleStateError);

  // Initialize state with validated and repaired data
  const initializeState = (initialTasks) => {
    try {
      // Handle potentially malformed data
      const personalResult = handleMalformedTaskData(initialTasks.personal || []);
      const workResult = handleMalformedTaskData(initialTasks.work || []);

      // Log any repair issues
      if (personalResult.errors.length > 0) {
        handleStateError('Issues found in personal tasks during initialization', personalResult.errors);
      }
      if (workResult.errors.length > 0) {
        handleStateError('Issues found in work tasks during initialization', workResult.errors);
      }

      // Validate the repaired data
      const personalValidation = validateTaskArray(personalResult.repairedTasks);
      const workValidation = validateTaskArray(workResult.repairedTasks);
      
      if (!personalValidation.isValid) {
        handleStateError('Invalid personal tasks detected after repair', personalValidation.errors);
      }
      
      if (!workValidation.isValid) {
        handleStateError('Invalid work tasks detected after repair', workValidation.errors);
      }

      return {
        personal: personalValidation.validTasks || [],
        work: workValidation.validTasks || []
      };
    } catch (error) {
      handleStateError('Critical error during state initialization', { error: error.message });
      // Return safe fallback state
      return {
        personal: [],
        work: []
      };
    }
  };

  const validatedInitialTasks = initializeState(INITIAL_TASKS);

  // State management for tasks and active category
  const [personalTasks, setPersonalTasks] = useState(validatedInitialTasks.personal);
  const [workTasks, setWorkTasks] = useState(validatedInitialTasks.work);
  const [activeCategory, setActiveCategory] = useState('personal');
  const [newTaskId, setNewTaskId] = useState(null); // Track which task is being created
  
  // Validate and set daily progress with error handling
  const progressValidation = validateProgressPercentage(DAILY_PROGRESS);
  if (!progressValidation.isValid) {
    handleStateError('Invalid daily progress value', progressValidation.errors);
  }
  const [dailyProgress] = useState(progressValidation.value);

  // Create safe state updaters
  const safeSetPersonalTasks = createSafeStateUpdater(
    (updateFn) => setPersonalTasks(updateFn), 
    handleStateError
  );
  
  const safeSetWorkTasks = createSafeStateUpdater(
    (updateFn) => setWorkTasks(updateFn), 
    handleStateError
  );

  // Reset to initial data in case of critical errors
  const handleDataReset = useCallback(() => {
    try {
      const resetTasks = initializeState(INITIAL_TASKS);
      setPersonalTasks(resetTasks.personal);
      setWorkTasks(resetTasks.work);
      setActiveCategory('personal');
      setErrors([]);
      console.log('Data reset to initial state');
    } catch (error) {
      handleStateError('Failed to reset data', { error: error.message });
    }
  }, [handleStateError]);

  // Error boundary error handler
  const handleComponentError = useCallback((error, errorInfo) => {
    handleStateError('Component error caught by boundary', { 
      error: error.message, 
      componentStack: errorInfo.componentStack 
    });
  }, [handleStateError]);

  // Category filtering logic with validation
  const handleCategoryChange = (category) => {
    if (!validateCategory(category)) {
      handleStateError('Invalid category change attempted', { category });
      return;
    }
    setActiveCategory(category);
  };

  // Helper function to check if a section should be converted to a normal task
  const shouldConvertSection = (sectionId, tasks) => {
    // A section should be converted if it has no child tasks
    return !tasks.some(task => task.parentId === sectionId);
  };

  // Helper function to convert section to normal task
  const convertSectionToTask = (sectionTask) => {
    return {
      ...sectionTask,
      description: sectionTask.description.toLowerCase() // Convert from all caps to normal case
    };
  };

  // Task completion handler with validation and hierarchical support
  const handleTaskComplete = (taskId) => {
    if (!taskId || typeof taskId !== 'string') {
      handleStateError('Invalid task ID for completion', { taskId });
      return;
    }

    try {
      // Clear new task ID if this was a new task being completed/cancelled
      if (newTaskId === taskId) {
        setNewTaskId(null);
      }

      if (activeCategory === 'personal') {
        safeSetPersonalTasks(prevTasks => {
          const taskExists = prevTasks.some(task => task.id === taskId);
          if (!taskExists) {
            handleStateError('Attempted to complete non-existent personal task', { taskId });
            return prevTasks;
          }

          // Find the task being completed
          const completedTask = prevTasks.find(task => task.id === taskId);
          
          // Ensure child task completion doesn't affect parent sections
          // Only remove the specific task that was completed
          let updatedTasks = prevTasks.filter(task => task.id !== taskId);
          
          // Handle section conversion when last child is completed
          if (completedTask && completedTask.parentId) {
            const parentSection = updatedTasks.find(task => task.id === completedTask.parentId);
            if (parentSection && shouldConvertSection(completedTask.parentId, updatedTasks)) {
              // Convert the section to a normal task when no children remain
              updatedTasks = updatedTasks.map(task => 
                task.id === completedTask.parentId 
                  ? convertSectionToTask(task)
                  : task
              );
            }
          }
          
          // If completing a section task, also remove all its child tasks
          if (completedTask && !completedTask.parentId && isSection(completedTask, prevTasks)) {
            updatedTasks = updatedTasks.filter(task => task.parentId !== completedTask.id);
          }
          
          return updatedTasks;
        });
      } else if (activeCategory === 'work') {
        safeSetWorkTasks(prevTasks => {
          const taskExists = prevTasks.some(task => task.id === taskId);
          if (!taskExists) {
            handleStateError('Attempted to complete non-existent work task', { taskId });
            return prevTasks;
          }

          // Find the task being completed
          const completedTask = prevTasks.find(task => task.id === taskId);
          
          // Ensure child task completion doesn't affect parent sections
          // Only remove the specific task that was completed
          let updatedTasks = prevTasks.filter(task => task.id !== taskId);
          
          // Handle section conversion when last child is completed
          if (completedTask && completedTask.parentId) {
            const parentSection = updatedTasks.find(task => task.id === completedTask.parentId);
            if (parentSection && shouldConvertSection(completedTask.parentId, updatedTasks)) {
              // Convert the section to a normal task when no children remain
              updatedTasks = updatedTasks.map(task => 
                task.id === completedTask.parentId 
                  ? convertSectionToTask(task)
                  : task
              );
            }
          }
          
          // If completing a section task, also remove all its child tasks
          if (completedTask && !completedTask.parentId && isSection(completedTask, prevTasks)) {
            updatedTasks = updatedTasks.filter(task => task.parentId !== completedTask.id);
          }
          
          return updatedTasks;
        });
      } else {
        handleStateError('Invalid active category during task completion', { activeCategory, taskId });
      }
    } catch (error) {
      handleStateError('Error during task completion', { error: error.message, taskId });
    }
  };

  // Task reordering handler with flexible hierarchical support
  const handleTaskReorder = (reorderedTasks) => {
    if (!Array.isArray(reorderedTasks)) {
      handleStateError('Invalid reordered tasks - not an array', { reorderedTasks });
      return;
    }

    const validation = validateTaskArray(reorderedTasks);
    if (!validation.isValid) {
      handleStateError('Invalid reordered tasks failed validation', validation.errors);
      return;
    }

    // Ensure all tasks belong to the current category
    const invalidCategoryTasks = reorderedTasks.filter(task => task.category !== activeCategory);
    if (invalidCategoryTasks.length > 0) {
      handleStateError('Reordered tasks contain wrong category', { 
        activeCategory, 
        invalidTasks: invalidCategoryTasks.map(t => ({ id: t.id, category: t.category }))
      });
      return;
    }

    // Basic validation - ensure parent-child relationships are valid
    const taskIds = new Set(reorderedTasks.map(task => task.id));
    const orphanedTasks = reorderedTasks.filter(task => 
      task.parentId && !taskIds.has(task.parentId)
    );
    
    if (orphanedTasks.length > 0) {
      handleStateError('Reordered tasks contain orphaned child tasks', {
        orphanedTasks: orphanedTasks.map(t => ({ id: t.id, parentId: t.parentId }))
      });
      return;
    }

    try {
      if (activeCategory === 'personal') {
        safeSetPersonalTasks(reorderedTasks);
      } else if (activeCategory === 'work') {
        safeSetWorkTasks(reorderedTasks);
      } else {
        handleStateError('Invalid active category during task reordering', { activeCategory });
      }
    } catch (error) {
      handleStateError('Error during task reordering', { error: error.message, activeCategory });
    }
  };

  // Get current tasks based on active category with validation and empty state handling
  const getCurrentTasks = () => {
    try {
      let tasks = [];
      if (activeCategory === 'personal') {
        tasks = personalTasks;
      } else if (activeCategory === 'work') {
        tasks = workTasks;
      } else {
        handleStateError('Invalid active category when getting current tasks', { activeCategory });
        return [];
      }

      // Validate current tasks
      const validation = validateTaskArray(tasks);
      if (!validation.isValid) {
        handleStateError('Current tasks failed validation', validation.errors);
        return validation.validTasks || [];
      }

      // Return tasks in hierarchical order
      return getTaskHierarchy(validation.validTasks || []);
    } catch (error) {
      handleStateError('Error getting current tasks', { error: error.message, activeCategory });
      return [];
    }
  };

  // Task creation handler - creates a new task inline
  const handleAddTask = (description = '', parentId = null) => {
    try {
      const newTask = {
        id: generateTaskId(),
        description: description.trim() || 'New Task',
        category: activeCategory,
        completed: false,
        order: 1, // Will be adjusted based on existing tasks
        createdAt: new Date(),
        ...(parentId && { parentId })
      };

      // Calculate proper order based on existing tasks
      const currentTasks = activeCategory === 'personal' ? personalTasks : workTasks;
      const tasksInSameLevel = parentId 
        ? currentTasks.filter(t => t.parentId === parentId)
        : currentTasks.filter(t => !t.parentId);
      
      newTask.order = tasksInSameLevel.length > 0 
        ? Math.max(...tasksInSameLevel.map(t => t.order)) + 1 
        : 1;

      // Set this as the new task being created
      setNewTaskId(newTask.id);

      // Add task to appropriate category
      if (activeCategory === 'personal') {
        safeSetPersonalTasks(prevTasks => [...prevTasks, newTask]);
      } else if (activeCategory === 'work') {
        safeSetWorkTasks(prevTasks => [...prevTasks, newTask]);
      } else {
        handleStateError('Invalid active category during task creation', { activeCategory });
      }
    } catch (error) {
      handleStateError('Error during task creation', { error: error.message, description, parentId });
    }
  };

  // Task rename handler
  const handleTaskRename = (taskId, newDescription) => {
    if (!taskId || typeof taskId !== 'string' || !newDescription || typeof newDescription !== 'string') {
      handleStateError('Invalid parameters for task rename', { taskId, newDescription });
      return;
    }

    try {
      const trimmedDescription = newDescription.trim();
      if (!trimmedDescription) {
        handleStateError('Empty description for task rename', { taskId });
        return;
      }

      // Clear new task ID if this was a new task being renamed
      if (newTaskId === taskId) {
        setNewTaskId(null);
      }

      if (activeCategory === 'personal') {
        safeSetPersonalTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, description: trimmedDescription }
              : task
          )
        );
      } else if (activeCategory === 'work') {
        safeSetWorkTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId 
              ? { ...task, description: trimmedDescription }
              : task
          )
        );
      } else {
        handleStateError('Invalid active category during task rename', { activeCategory, taskId });
      }
    } catch (error) {
      handleStateError('Error during task rename', { error: error.message, taskId, newDescription });
    }
  };

  // Wrapper function for AddTaskButtons component
  const handleAddTaskClick = () => {
    handleAddTask();
  };

  const currentTasks = getCurrentTasks();
  const emptyState = handleEmptyState(currentTasks, 'tasks');

  return (
    <div className={styles.page}>
      {/* Static Background */}
      <div className={styles.pageBackground}>
        <Background />
      </div>

      {/* Navbar moved outside animated container */}
      <Navbar />

      <div className={styles.pageContent}>
        <h1 className={styles.title}>Tasks</h1>     
        
        {/* Loading indicator */}
        {isLoading && (
          <div className={styles.loadingContainer}>
            <p className={styles.loadingText}>Loading...</p>
          </div>
        )}
        
        {/* Error display for validation failures */}
        {errors.length > 0 && (
          <div className={styles.errorContainer}>
            <h3 className={styles.errorTitle}>System Errors:</h3>
            {errors.slice(-3).map((error, index) => (
              <div key={index} className={styles.errorMessage}>
                <strong>{error.message}</strong>
                {error.details && (
                  <div className={styles.errorDetails}>
                    {Array.isArray(error.details) 
                      ? error.details.join(', ') 
                      : JSON.stringify(error.details)
                    }
                  </div>
                )}
              </div>
            ))}
            {errors.length > 3 && (
              <p className={styles.errorCount}>
                ... and {errors.length - 3} more errors
              </p>
            )}
            <button 
              className={styles.clearErrorsButton}
              onClick={() => setErrors([])}
              type="button"
            >
              Clear Errors
            </button>
          </div>
        )}
        
        {/* TaskToggle component with category filtering wrapped in error boundary */}
        <ErrorBoundary 
          title="Category Toggle Error"
          message="The category toggle component encountered an error."
          onError={handleComponentError}
          onReset={handleDataReset}
        >
          <TaskToggle 
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
          />
        </ErrorBoundary>
        
        {/* DailyProgressBar component with hardcoded progress wrapped in error boundary */}
        <ErrorBoundary 
          title="Progress Bar Error"
          message="The progress bar component encountered an error."
          onError={handleComponentError}
        >
          <DailyProgressBar percentage={dailyProgress} />
        </ErrorBoundary>
        
        {/* TaskContainer with task completion and reordering wrapped in error boundary */}
        <ErrorBoundary 
          title="Task Container Error"
          message="The task container component encountered an error."
          onError={handleComponentError}
          onReset={handleDataReset}
        >
          <TaskContainer
            title={`${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} TODO`}
            tasks={currentTasks}
            onTaskComplete={handleTaskComplete}
            onTaskReorder={handleTaskReorder}
            onTaskRename={handleTaskRename}
            onAddTask={handleAddTaskClick}
            newTaskId={newTaskId}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

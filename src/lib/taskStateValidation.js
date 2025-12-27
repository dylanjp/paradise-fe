/**
 * Task State Validation Utilities
 * Provides validation and error handling for task state management
 */

/**
 * Validates a single task object
 * @param {Object} task - Task object to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const validateTask = (task) => {
  if (!task || typeof task !== 'object') {
    return false;
  }

  // Required fields validation
  const requiredFields = ['id', 'description', 'category', 'completed'];
  for (const field of requiredFields) {
    if (!(field in task)) {
      return false;
    }
  }

  // Type validation
  if (typeof task.id !== 'string' || task.id.trim() === '') {
    return false;
  }

  if (typeof task.description !== 'string' || task.description.trim() === '') {
    return false;
  }

  if (!['personal', 'work'].includes(task.category)) {
    return false;
  }

  if (typeof task.completed !== 'boolean') {
    return false;
  }

  // Optional fields validation
  if ('order' in task && (typeof task.order !== 'number' || task.order < 0)) {
    return false;
  }

  if ('createdAt' in task && !(task.createdAt instanceof Date)) {
    return false;
  }

  return true;
};

/**
 * Validates an array of tasks
 * @param {Array} tasks - Array of task objects
 * @returns {Object} - Validation result with isValid and errors
 */
export const validateTaskArray = (tasks) => {
  const result = {
    isValid: true,
    errors: [],
    validTasks: []
  };

  if (!Array.isArray(tasks)) {
    result.isValid = false;
    result.errors.push('Tasks must be an array');
    return result;
  }

  const seenIds = new Set();
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    
    if (!validateTask(task)) {
      result.isValid = false;
      result.errors.push(`Invalid task at index ${i}: ${JSON.stringify(task)}`);
      continue;
    }

    // Check for duplicate IDs
    if (seenIds.has(task.id)) {
      result.isValid = false;
      result.errors.push(`Duplicate task ID found: ${task.id}`);
      continue;
    }

    seenIds.add(task.id);
    result.validTasks.push(task);
  }

  return result;
};

/**
 * Validates category parameter
 * @param {string} category - Category to validate
 * @returns {boolean} - True if valid category
 */
export const validateCategory = (category) => {
  return typeof category === 'string' && ['personal', 'work'].includes(category);
};

/**
 * Validates task state consistency
 * @param {Object} state - Current task state
 * @returns {Object} - Validation result
 */
export const validateTaskState = (state) => {
  const result = {
    isValid: true,
    errors: []
  };

  if (!state || typeof state !== 'object') {
    result.isValid = false;
    result.errors.push('State must be an object');
    return result;
  }

  // Validate personal tasks
  if ('personalTasks' in state) {
    const personalValidation = validateTaskArray(state.personalTasks);
    if (!personalValidation.isValid) {
      result.isValid = false;
      result.errors.push(...personalValidation.errors.map(err => `Personal tasks: ${err}`));
    }

    // Ensure all personal tasks have correct category
    const invalidPersonalTasks = state.personalTasks.filter(task => task.category !== 'personal');
    if (invalidPersonalTasks.length > 0) {
      result.isValid = false;
      result.errors.push(`Personal tasks with wrong category: ${invalidPersonalTasks.map(t => t.id).join(', ')}`);
    }
  }

  // Validate work tasks
  if ('workTasks' in state) {
    const workValidation = validateTaskArray(state.workTasks);
    if (!workValidation.isValid) {
      result.isValid = false;
      result.errors.push(...workValidation.errors.map(err => `Work tasks: ${err}`));
    }

    // Ensure all work tasks have correct category
    const invalidWorkTasks = state.workTasks.filter(task => task.category !== 'work');
    if (invalidWorkTasks.length > 0) {
      result.isValid = false;
      result.errors.push(`Work tasks with wrong category: ${invalidWorkTasks.map(t => t.id).join(', ')}`);
    }
  }

  // Validate active category
  if ('activeCategory' in state && !validateCategory(state.activeCategory)) {
    result.isValid = false;
    result.errors.push(`Invalid active category: ${state.activeCategory}`);
  }

  // Check for cross-contamination between categories
  if (state.personalTasks && state.workTasks) {
    const personalIds = new Set(state.personalTasks.map(t => t.id));
    const workIds = new Set(state.workTasks.map(t => t.id));
    
    const duplicateIds = [...personalIds].filter(id => workIds.has(id));
    if (duplicateIds.length > 0) {
      result.isValid = false;
      result.errors.push(`Tasks exist in both categories: ${duplicateIds.join(', ')}`);
    }
  }

  return result;
};

/**
 * Sanitizes and filters invalid tasks from an array
 * @param {Array} tasks - Array of tasks to sanitize
 * @returns {Array} - Array of valid tasks only
 */
export const sanitizeTaskArray = (tasks) => {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks.filter(task => validateTask(task));
};

/**
 * Creates a safe state update function that validates before applying changes
 * @param {Function} setState - React setState function
 * @param {Function} onError - Error callback function
 * @returns {Function} - Safe state update function
 */
export const createSafeStateUpdater = (setState, onError = console.error) => {
  return (updateFunction) => {
    setState(prevState => {
      try {
        const newState = typeof updateFunction === 'function' 
          ? updateFunction(prevState) 
          : updateFunction;

        const validation = validateTaskState(newState);
        
        if (!validation.isValid) {
          onError('State validation failed:', validation.errors);
          return prevState; // Return previous state if validation fails
        }

        return newState;
      } catch (error) {
        onError('State update error:', error);
        return prevState; // Return previous state if update fails
      }
    });
  };
};

/**
 * Validates progress percentage value
 * @param {number} percentage - Progress percentage to validate
 * @returns {Object} - Validation result with clamped value
 */
export const validateProgressPercentage = (percentage) => {
  const result = {
    isValid: true,
    value: 0,
    errors: []
  };

  if (typeof percentage !== 'number') {
    result.isValid = false;
    result.errors.push('Progress percentage must be a number');
    result.value = 0;
    return result;
  }

  if (isNaN(percentage)) {
    result.isValid = false;
    result.errors.push('Progress percentage cannot be NaN');
    result.value = 0;
    return result;
  }

  if (!isFinite(percentage)) {
    result.isValid = false;
    result.errors.push('Progress percentage must be finite');
    result.value = 0;
    return result;
  }

  // Clamp value between 0 and 100
  result.value = Math.max(0, Math.min(100, percentage));
  
  if (percentage < 0 || percentage > 100) {
    result.errors.push(`Progress percentage ${percentage} was clamped to ${result.value}`);
  }

  return result;
};

/**
 * Validates component props for safety
 * @param {Object} props - Component props to validate
 * @param {Array} requiredProps - Array of required prop names
 * @returns {Object} - Validation result
 */
export const validateComponentProps = (props, requiredProps = []) => {
  const result = {
    isValid: true,
    errors: [],
    sanitizedProps: { ...props }
  };

  if (!props || typeof props !== 'object') {
    result.isValid = false;
    result.errors.push('Props must be an object');
    result.sanitizedProps = {};
    return result;
  }

  // Check required props
  for (const propName of requiredProps) {
    if (!(propName in props) || props[propName] === undefined || props[propName] === null) {
      result.isValid = false;
      result.errors.push(`Required prop '${propName}' is missing or null`);
    }
  }

  // Sanitize function props
  Object.keys(props).forEach(key => {
    if (typeof props[key] === 'function') {
      // Wrap functions in try-catch for safety
      const originalFn = props[key];
      result.sanitizedProps[key] = (...args) => {
        try {
          return originalFn(...args);
        } catch (error) {
          console.error(`Error in prop function '${key}':`, error);
          return undefined;
        }
      };
    }
  });

  return result;
};

/**
 * Handles malformed task data by attempting to repair or filter
 * @param {Array} tasks - Array of potentially malformed tasks
 * @returns {Object} - Result with repaired tasks and errors
 */
export const handleMalformedTaskData = (tasks) => {
  const result = {
    repairedTasks: [],
    errors: [],
    droppedTasks: []
  };

  if (!Array.isArray(tasks)) {
    result.errors.push('Task data is not an array, returning empty array');
    return result;
  }

  tasks.forEach((task, index) => {
    try {
      // Attempt to repair common issues
      const repairedTask = repairTask(task, index);
      
      if (repairedTask && validateTask(repairedTask)) {
        result.repairedTasks.push(repairedTask);
      } else {
        result.droppedTasks.push({ index, task, reason: 'Could not repair task' });
        result.errors.push(`Dropped malformed task at index ${index}: ${JSON.stringify(task)}`);
      }
    } catch (error) {
      result.droppedTasks.push({ index, task, reason: error.message });
      result.errors.push(`Error processing task at index ${index}: ${error.message}`);
    }
  });

  return result;
};

/**
 * Attempts to repair a malformed task object
 * @param {Object} task - Task to repair
 * @param {number} index - Index for generating fallback values
 * @returns {Object|null} - Repaired task or null if unrepairable
 */
const repairTask = (task, index) => {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const repaired = { ...task };

  // Repair missing or invalid ID
  if (!repaired.id || typeof repaired.id !== 'string' || repaired.id.trim() === '') {
    repaired.id = `repaired-task-${Date.now()}-${index}`;
  }

  // Repair missing or invalid description
  if (!repaired.description || typeof repaired.description !== 'string') {
    repaired.description = `Task ${repaired.id}`;
  } else {
    repaired.description = repaired.description.trim();
    if (repaired.description === '') {
      repaired.description = `Task ${repaired.id}`;
    }
  }

  // Repair missing or invalid category
  if (!['personal', 'work'].includes(repaired.category)) {
    repaired.category = 'personal'; // Default to personal
  }

  // Repair missing or invalid completed status
  if (typeof repaired.completed !== 'boolean') {
    repaired.completed = false;
  }

  // Repair missing or invalid order
  if (typeof repaired.order !== 'number' || repaired.order < 0 || !isFinite(repaired.order)) {
    repaired.order = index + 1;
  }

  // Add missing createdAt if not present
  if (!repaired.createdAt || !(repaired.createdAt instanceof Date)) {
    repaired.createdAt = new Date();
  }

  return repaired;
};

/**
 * Creates a loading state handler for async operations
 * @param {Function} setLoading - Loading state setter
 * @param {Function} onError - Error callback
 * @returns {Function} - Async operation wrapper
 */
export const createLoadingHandler = (setLoading, onError = console.error) => {
  return async (asyncOperation, operationName = 'operation') => {
    try {
      setLoading(true);
      const result = await asyncOperation();
      return result;
    } catch (error) {
      onError(`Error during ${operationName}:`, error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
};

/**
 * Validates and handles empty states
 * @param {Array} data - Data array to check
 * @param {string} dataType - Type of data for error messages
 * @returns {Object} - Empty state information
 */
export const handleEmptyState = (data, dataType = 'data') => {
  const result = {
    isEmpty: false,
    message: '',
    suggestion: ''
  };

  if (!Array.isArray(data)) {
    result.isEmpty = true;
    result.message = `No ${dataType} available`;
    result.suggestion = `${dataType} could not be loaded`;
    return result;
  }

  if (data.length === 0) {
    result.isEmpty = true;
    result.message = `No ${dataType} yet`;
    result.suggestion = dataType === 'tasks' 
      ? 'Your completed tasks will disappear from this list'
      : `Add some ${dataType} to get started`;
  }

  return result;
};
import { useReducer, useMemo, useCallback } from "react";

/**
 * Initial hardcoded daily tasks for demonstration purposes
 * These will be replaced with backend data in the future
 */
const INITIAL_DAILY_TASKS = [
  {
    id: "1",
    description: "Morning meditation",
    completed: false,
    order: 1,
    createdAt: new Date(),
  },
  {
    id: "2",
    description: "Review daily goals",
    completed: false,
    order: 2,
    createdAt: new Date(),
  },
  {
    id: "3",
    description: "Exercise for 30 minutes",
    completed: false,
    order: 3,
    createdAt: new Date(),
  },
  {
    id: "4",
    description: "Read for 20 minutes",
    completed: false,
    order: 4,
    createdAt: new Date(),
  },
  {
    id: "5",
    description: "Plan tomorrow",
    completed: false,
    order: 5,
    createdAt: new Date(),
  },
];

/**
 * Reducer action types
 */
const ActionTypes = {
  TOGGLE_TASK: "TOGGLE_TASK",
  ADD_TASK: "ADD_TASK",
  RESET_ALL: "RESET_ALL",
};

/**
 * Reducer for daily task state management
 */
const dailyTaskReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.TOGGLE_TASK: {
      const taskId = action.payload;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task,
        ),
      };
    }

    case ActionTypes.ADD_TASK: {
      const { description } = action.payload;

      // Validation: reject empty or whitespace-only descriptions
      if (!description || !description.trim()) {
        return state;
      }

      const maxOrder =
        state.tasks.length > 0
          ? Math.max(...state.tasks.map((t) => t.order))
          : 0;

      const newTask = {
        id: crypto.randomUUID(),
        description: description.trim(),
        completed: false,
        order: maxOrder + 1,
        createdAt: new Date(),
      };

      return {
        ...state,
        tasks: [...state.tasks, newTask],
      };
    }

    case ActionTypes.RESET_ALL: {
      return {
        ...state,
        tasks: state.tasks.map((task) => ({ ...task, completed: false })),
      };
    }

    default:
      return state;
  }
};

/**
 * Custom hook for managing daily task state
 *
 * @param {Array} initialTasks - Optional initial tasks array (defaults to INITIAL_DAILY_TASKS)
 * @returns {Object} Daily task state and action handlers
 */
export function useDailyTaskManager(initialTasks = INITIAL_DAILY_TASKS) {
  const [state, dispatch] = useReducer(dailyTaskReducer, {
    tasks: initialTasks,
  });

  // Calculate completed count
  const completedCount = useMemo(
    () => state.tasks.filter((task) => task.completed).length,
    [state.tasks],
  );

  // Calculate total count
  const totalCount = useMemo(() => state.tasks.length, [state.tasks]);

  // Calculate progress percentage (0-100)
  const progressPercentage = useMemo(() => {
    if (totalCount === 0) return 0;
    return Math.round((completedCount / totalCount) * 100);
  }, [completedCount, totalCount]);

  // Action handlers
  const toggleTask = useCallback((taskId) => {
    dispatch({ type: ActionTypes.TOGGLE_TASK, payload: taskId });
  }, []);

  const addTask = useCallback((description) => {
    dispatch({ type: ActionTypes.ADD_TASK, payload: { description } });
  }, []);

  const resetAllTasks = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_ALL });
  }, []);

  return {
    dailyTasks: state.tasks,
    completedCount,
    totalCount,
    progressPercentage,
    toggleTask,
    addTask,
    resetAllTasks,
  };
}

// Export for testing purposes
export { INITIAL_DAILY_TASKS };

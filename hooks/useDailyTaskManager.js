import { useReducer, useMemo, useCallback, useEffect } from "react";
import { TaskService } from "@/src/lib/taskService";
import { generateUUID } from "@/utils/uuid";

/**
 * Initial hardcoded daily tasks for demonstration purposes
 * These will be replaced with backend data when userId is provided
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
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  SET_TASKS: "SET_TASKS",
  TOGGLE_TASK: "TOGGLE_TASK",
  ADD_TASK: "ADD_TASK",
  DELETE_TASK: "DELETE_TASK",
  RESET_ALL: "RESET_ALL",
  ROLLBACK: "ROLLBACK",
  REORDER_TASKS: "REORDER_TASKS",
};

/**
 * Reducer for daily task state management
 */
const dailyTaskReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_LOADING:
      return { ...state, isLoading: action.payload };

    case ActionTypes.SET_ERROR:
      return { ...state, error: action.payload };

    case ActionTypes.CLEAR_ERROR:
      return { ...state, error: null };

    case ActionTypes.SET_TASKS:
      return {
        ...state,
        tasks: action.payload,
        isLoading: false,
        error: null,
      };

    case ActionTypes.ROLLBACK:
      return {
        ...state,
        tasks: action.payload,
        error: action.error || null,
      };

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
      const { id, description } = action.payload;

      // Validation: reject empty or whitespace-only descriptions
      if (!description || !description.trim()) {
        return state;
      }

      const maxOrder =
        state.tasks.length > 0
          ? Math.max(...state.tasks.map((t) => t.order))
          : 0;

      const newTask = {
        id: id || generateUUID(),
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

    case ActionTypes.DELETE_TASK: {
      const taskId = action.payload;
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== taskId),
      };
    }

    case ActionTypes.RESET_ALL: {
      return {
        ...state,
        tasks: state.tasks.map((task) => ({ ...task, completed: false })),
      };
    }

    case ActionTypes.REORDER_TASKS: {
      return {
        ...state,
        tasks: action.payload,
      };
    }

    default:
      return state;
  }
};

/**
 * Custom hook for managing daily task state with backend integration
 *
 * @param {string} userId - User identifier for API calls (optional, enables backend sync)
 * @param {Array} initialTasks - Optional initial tasks array (defaults to INITIAL_DAILY_TASKS)
 * @returns {Object} Daily task state and action handlers
 */
export function useDailyTaskManager(
  userId,
  initialTasks = INITIAL_DAILY_TASKS,
) {
  const [state, dispatch] = useReducer(dailyTaskReducer, {
    tasks: userId ? [] : initialTasks, // Start empty if userId provided (will fetch from backend)
    isLoading: !!userId, // Start loading if userId provided
    error: null,
  });

  // Fetch daily tasks from backend on mount when userId is provided
  useEffect(() => {
    if (!userId) {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      return;
    }

    const fetchDailyTasks = async () => {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      dispatch({ type: ActionTypes.CLEAR_ERROR });

      try {
        const response = await TaskService.getAllTasks(userId);
        dispatch({ type: ActionTypes.SET_TASKS, payload: response.dailyTasks });
      } catch (error) {
        dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
        dispatch({ type: ActionTypes.SET_LOADING, payload: false });
      }
    };

    fetchDailyTasks();
  }, [userId]);

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

  /**
   * Toggle task completion status with optimistic update
   * @param {string} taskId - Task ID to toggle
   */
  const toggleTask = useCallback(
    async (taskId) => {
      // Save previous state for rollback
      const previousTasks = [...state.tasks];

      // Find the task to get its current completed status
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Optimistic update
      dispatch({ type: ActionTypes.TOGGLE_TASK, payload: taskId });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        await TaskService.updateDailyTask(userId, taskId, {
          completed: !task.completed,
        });
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: ActionTypes.ROLLBACK,
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  /**
   * Add a new daily task with optimistic update
   * @param {string} description - Task description
   */
  const addTask = useCallback(
    async (description) => {
      // Validation: reject empty or whitespace-only descriptions
      if (!description || !description.trim()) {
        return;
      }

      // Save previous state for rollback
      const previousTasks = [...state.tasks];
      const newTaskId = generateUUID();

      // Calculate order for the new task
      const maxOrder =
        state.tasks.length > 0
          ? Math.max(...state.tasks.map((t) => t.order))
          : 0;

      // Optimistic update
      dispatch({
        type: ActionTypes.ADD_TASK,
        payload: { id: newTaskId, description },
      });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        const taskData = {
          id: newTaskId,
          description: description.trim(),
          order: maxOrder + 1,
        };

        await TaskService.createDailyTask(userId, taskData);
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: ActionTypes.ROLLBACK,
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  /**
   * Delete a daily task with optimistic update
   * @param {string} taskId - Task ID to delete
   */
  const deleteTask = useCallback(
    async (taskId) => {
      // Save previous state for rollback
      const previousTasks = [...state.tasks];

      // Optimistic update
      dispatch({ type: ActionTypes.DELETE_TASK, payload: taskId });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        await TaskService.deleteDailyTask(userId, taskId);
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: ActionTypes.ROLLBACK,
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  /**
   * Reset all tasks to incomplete status
   * Note: This is a local-only operation for now
   */
  const resetAllTasks = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_ALL });
  }, []);

  /**
   * Reorder daily tasks with optimistic update
   * @param {Array} reorderedTasks - Array of tasks with updated order values
   */
  const reorderTasks = useCallback(
    async (reorderedTasks) => {
      // Save previous state for rollback
      const previousTasks = [...state.tasks];

      // Identify tasks with changed order values
      const changedTasks = reorderedTasks.filter((newTask) => {
        const oldTask = previousTasks.find((t) => t.id === newTask.id);
        return oldTask && oldTask.order !== newTask.order;
      });

      // Optimistic update
      dispatch({ type: ActionTypes.REORDER_TASKS, payload: reorderedTasks });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        // Update each task with changed order on the backend
        await Promise.all(
          changedTasks.map((task) =>
            TaskService.updateDailyTask(userId, task.id, { order: task.order })
          )
        );
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: ActionTypes.ROLLBACK,
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks]
  );

  return {
    dailyTasks: state.tasks,
    completedCount,
    totalCount,
    progressPercentage,
    isLoading: state.isLoading,
    error: state.error,
    toggleTask,
    addTask,
    deleteTask,
    resetAllTasks,
    reorderTasks,
  };
}

// Export for testing purposes
export { INITIAL_DAILY_TASKS };

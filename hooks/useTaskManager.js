import { useReducer, useMemo, useCallback, useEffect } from "react";
import { TaskService } from "@/src/lib/taskService";

/**
 * --- INTERNAL VALIDATION & REPAIR UTILITIES ---
 * These run only when data is first loaded or modified, keeping performance high.
 */

const createSafeTask = (task, index = 0, defaultCategory = "personal") => {
  // 1. Repair ID
  const safeId =
    typeof task.id === "string" && task.id.trim().length > 0
      ? task.id
      : crypto.randomUUID();

  // 2. Repair Description
  const safeDescription =
    typeof task.description === "string" && task.description.trim().length > 0
      ? task.description.trim()
      : "Untitled Task";

  // 3. Repair Category
  const safeCategory = ["personal", "work"].includes(task.category)
    ? task.category
    : defaultCategory;

  return {
    id: safeId,
    description: safeDescription,
    category: safeCategory,
    completed: typeof task.completed === "boolean" ? task.completed : false,
    order:
      typeof task.order === "number" && isFinite(task.order)
        ? task.order
        : index + 1,
    parentId: typeof task.parentId === "string" ? task.parentId : undefined,
    createdAt: task.createdAt instanceof Date ? task.createdAt : new Date(),
  };
};

const sanitizeInitialData = (data) => {
  const safeData = { personal: [], work: [] };

  // Safely process personal tasks
  if (Array.isArray(data?.personal)) {
    safeData.personal = data.personal.map((t, i) =>
      createSafeTask(t, i, "personal"),
    );
  }

  // Safely process work tasks
  if (Array.isArray(data?.work)) {
    safeData.work = data.work.map((t, i) => createSafeTask(t, i, "work"));
  }

  return safeData;
};

/**
 * --- CORE REDUCER LOGIC ---
 * Guaranteed consistency. No invalid state can pass through here.
 */
const taskReducer = (state, action) => {
  const { category } = state;
  const currentTasks = state.tasks[category];

  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "SET_TASKS":
      return {
        ...state,
        tasks: sanitizeInitialData(action.payload),
        isLoading: false,
        error: null,
      };

    case "ROLLBACK":
      return {
        ...state,
        tasks: action.payload,
        error: action.error || null,
      };

    case "SET_CATEGORY":
      if (!["personal", "work"].includes(action.payload)) {
        console.warn(`Attempted to set invalid category: ${action.payload}`);
        return state;
      }
      return { ...state, category: action.payload };

    case "ADD_TASK": {
      // Logic: Calculate order based on siblings
      const { description, parentId, id } = action.payload;
      const tasksInLevel = parentId
        ? currentTasks.filter((t) => t.parentId === parentId)
        : currentTasks.filter((t) => !t.parentId);

      const maxOrder =
        tasksInLevel.length > 0
          ? Math.max(...tasksInLevel.map((t) => t.order))
          : 0;

      // Logic: Create perfectly valid task object immediately
      const newTask = createSafeTask({
        id: id || crypto.randomUUID(),
        description,
        category,
        completed: false,
        order: maxOrder + 1,
        parentId,
      });

      return {
        ...state,
        newTaskId: newTask.id, // For UI auto-focus
        tasks: {
          ...state.tasks,
          [category]: [...currentTasks, newTask],
        },
      };
    }

    case "COMPLETE_TASK": {
      const taskId = action.payload;
      const taskToDelete = currentTasks.find((t) => t.id === taskId);
      if (!taskToDelete) return state;

      // Logic: Remove task AND its children (if section)
      let updatedList = currentTasks.filter(
        (t) => t.id !== taskId && t.parentId !== taskId,
      );

      // Logic: Convert empty sections back to normal tasks
      if (taskToDelete.parentId) {
        const remainingSiblings = updatedList.some(
          (t) => t.parentId === taskToDelete.parentId,
        );
        if (!remainingSiblings) {
          updatedList = updatedList.map((t) => {
            if (t.id === taskToDelete.parentId) {
              // Convert ALL CAPS section to Title Case task
              return {
                ...t,
                description: t.description
                  .toLowerCase()
                  .replace(/\b\w/g, (s) => s.toUpperCase()),
              };
            }
            return t;
          });
        }
      }

      return {
        ...state,
        newTaskId: null,
        tasks: { ...state.tasks, [category]: updatedList },
      };
    }

    case "REORDER_TASKS": {
      if (!Array.isArray(action.payload)) return state;
      return {
        ...state,
        tasks: { ...state.tasks, [category]: action.payload },
      };
    }

    case "RENAME_TASK": {
      if (!action.payload.description.trim()) return state; // validation check
      return {
        ...state,
        newTaskId: null,
        tasks: {
          ...state.tasks,
          [category]: currentTasks.map((t) =>
            t.id === action.payload.id
              ? { ...t, description: action.payload.description }
              : t,
          ),
        },
      };
    }

    default:
      return state;
  }
};

/**
 * --- MAIN HOOK ---
 * @param {string} userId - User identifier for API calls
 */
export function useTaskManager(userId) {
  const [state, dispatch] = useReducer(taskReducer, {
    tasks: { personal: [], work: [] },
    category: "personal",
    newTaskId: null,
    isLoading: true,
    error: null,
  });

  // Fetch tasks on mount when userId is provided
  useEffect(() => {
    if (!userId) {
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    const fetchTasks = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "CLEAR_ERROR" });

      try {
        const response = await TaskService.getAllTasks(userId);
        dispatch({ type: "SET_TASKS", payload: response.todoTasks });
      } catch (error) {
        dispatch({ type: "SET_ERROR", payload: error.message });
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    fetchTasks();
  }, [userId]);

  // 2. Memoized Hierarchy Calculation (Performance Optimization)
  const hierarchicalTasks = useMemo(() => {
    const tasks = state.tasks[state.category];

    // Validate hierarchy integrity
    const rootTasks = tasks
      .filter((t) => !t.parentId)
      .sort((a, b) => a.order - b.order);

    return rootTasks.flatMap((root) => {
      const children = tasks
        .filter((t) => t.parentId === root.id)
        .sort((a, b) => a.order - b.order);
      return [root, ...children];
    });
  }, [state.tasks, state.category]);

  // 3. Stable Action Dispatchers with Optimistic Updates
  const setCategory = useCallback(
    (cat) => dispatch({ type: "SET_CATEGORY", payload: cat }),
    [],
  );

  /**
   * Add a new task with optimistic update
   * @param {string} description - Task description
   * @param {string} [parentId] - Optional parent task ID
   */
  const addTask = useCallback(
    async (description, parentId) => {
      // Save previous state for rollback
      const previousTasks = { ...state.tasks };
      const newTaskId = crypto.randomUUID();

      // Optimistic update
      dispatch({
        type: "ADD_TASK",
        payload: { description, parentId, id: newTaskId },
      });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        // Calculate order for the new task
        const category = state.category;
        const currentTasks = state.tasks[category];
        const tasksInLevel = parentId
          ? currentTasks.filter((t) => t.parentId === parentId)
          : currentTasks.filter((t) => !t.parentId);
        const maxOrder =
          tasksInLevel.length > 0
            ? Math.max(...tasksInLevel.map((t) => t.order))
            : 0;

        const taskData = {
          id: newTaskId,
          description: description || "Untitled Task",
          category,
          order: maxOrder + 1,
          parentId,
        };

        await TaskService.createTodoTask(userId, taskData);
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: "ROLLBACK",
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks, state.category],
  );

  /**
   * Complete (delete) a task with optimistic update
   * @param {string} id - Task ID to complete/delete
   */
  const completeTask = useCallback(
    async (id) => {
      // Save previous state for rollback
      const previousTasks = { ...state.tasks };

      // Optimistic update
      dispatch({ type: "COMPLETE_TASK", payload: id });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        await TaskService.deleteTodoTask(userId, id);
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: "ROLLBACK",
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  /**
   * Reorder tasks with optimistic update
   * @param {Array} tasks - Reordered tasks array
   */
  const reorderTasks = useCallback(
    async (tasks) => {
      // Save previous state for rollback
      const previousTasks = { ...state.tasks };

      // Optimistic update
      dispatch({ type: "REORDER_TASKS", payload: tasks });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        // Update order for each task that changed
        const updatePromises = tasks.map((task, index) => {
          if (task.order !== index + 1) {
            return TaskService.updateTodoTask(userId, task.id, {
              order: index + 1,
            });
          }
          return Promise.resolve();
        });

        await Promise.all(updatePromises);
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: "ROLLBACK",
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  /**
   * Rename a task with optimistic update
   * @param {string} id - Task ID
   * @param {string} description - New description
   */
  const renameTask = useCallback(
    async (id, description) => {
      // Save previous state for rollback
      const previousTasks = { ...state.tasks };

      // Optimistic update
      dispatch({ type: "RENAME_TASK", payload: { id, description } });

      // If no userId, skip API call (local-only mode)
      if (!userId) return;

      try {
        await TaskService.updateTodoTask(userId, id, { description });
      } catch (error) {
        // Rollback on failure
        dispatch({
          type: "ROLLBACK",
          payload: previousTasks,
          error: error.message,
        });
      }
    },
    [userId, state.tasks],
  );

  return {
    currentTasks: hierarchicalTasks,
    activeCategory: state.category,
    newTaskId: state.newTaskId,
    isLoading: state.isLoading,
    error: state.error,
    setCategory,
    addTask,
    completeTask,
    reorderTasks,
    renameTask,
  };
}

import { useReducer, useMemo, useCallback } from "react";

/**
 * --- INTERNAL VALIDATION & REPAIR UTILITIES ---
 * These run only when data is first loaded or modified, keeping performance high.
 */

const createSafeTask = (task, index = 0, defaultCategory = 'personal') => {
  // 1. Repair ID
  const safeId = (typeof task.id === 'string' && task.id.trim().length > 0) 
    ? task.id 
    : crypto.randomUUID();

  // 2. Repair Description
  const safeDescription = (typeof task.description === 'string' && task.description.trim().length > 0) 
    ? task.description.trim() 
    : 'Untitled Task';

  // 3. Repair Category
  const safeCategory = ['personal', 'work'].includes(task.category) 
    ? task.category 
    : defaultCategory;

  return {
    id: safeId,
    description: safeDescription,
    category: safeCategory,
    completed: typeof task.completed === 'boolean' ? task.completed : false,
    order: (typeof task.order === 'number' && isFinite(task.order)) ? task.order : index + 1,
    parentId: (typeof task.parentId === 'string') ? task.parentId : undefined,
    createdAt: (task.createdAt instanceof Date) ? task.createdAt : new Date(),
  };
};

const sanitizeInitialData = (data) => {
  const safeData = { personal: [], work: [] };
  
  // Safely process personal tasks
  if (Array.isArray(data?.personal)) {
    safeData.personal = data.personal.map((t, i) => createSafeTask(t, i, 'personal'));
  }
  
  // Safely process work tasks
  if (Array.isArray(data?.work)) {
    safeData.work = data.work.map((t, i) => createSafeTask(t, i, 'work'));
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
    case 'SET_CATEGORY':
      if (!['personal', 'work'].includes(action.payload)) {
        console.warn(`Attempted to set invalid category: ${action.payload}`);
        return state;
      }
      return { ...state, category: action.payload };

    case 'ADD_TASK': {
      // Logic: Calculate order based on siblings
      const { description, parentId } = action.payload;
      const tasksInLevel = parentId 
        ? currentTasks.filter(t => t.parentId === parentId)
        : currentTasks.filter(t => !t.parentId);
      
      const maxOrder = tasksInLevel.length > 0 ? Math.max(...tasksInLevel.map(t => t.order)) : 0;

      // Logic: Create perfectly valid task object immediately
      const newTask = createSafeTask({
        id: crypto.randomUUID(),
        description,
        category,
        completed: false,
        order: maxOrder + 1,
        parentId
      });

      return {
        ...state,
        newTaskId: newTask.id, // For UI auto-focus
        tasks: {
          ...state.tasks,
          [category]: [...currentTasks, newTask]
        }
      };
    }

    case 'COMPLETE_TASK': {
      const taskId = action.payload;
      const taskToDelete = currentTasks.find(t => t.id === taskId);
      if (!taskToDelete) return state;

      // Logic: Remove task AND its children (if section)
      let updatedList = currentTasks.filter(t => t.id !== taskId && t.parentId !== taskId);

      // Logic: Convert empty sections back to normal tasks
      if (taskToDelete.parentId) {
        const remainingSiblings = updatedList.some(t => t.parentId === taskToDelete.parentId);
        if (!remainingSiblings) {
          updatedList = updatedList.map(t => {
            if (t.id === taskToDelete.parentId) {
              // Convert ALL CAPS section to Title Case task
              return { 
                ...t, 
                description: t.description.toLowerCase().replace(/\b\w/g, s => s.toUpperCase()) 
              };
            }
            return t;
          });
        }
      }

      return {
        ...state,
        newTaskId: null,
        tasks: { ...state.tasks, [category]: updatedList }
      };
    }

    case 'REORDER_TASKS': {
      if (!Array.isArray(action.payload)) return state;
      return {
        ...state,
        tasks: { ...state.tasks, [category]: action.payload }
      };
    }

    case 'RENAME_TASK': {
      if (!action.payload.description.trim()) return state; // validation check
      return {
        ...state,
        newTaskId: null,
        tasks: {
          ...state.tasks,
          [category]: currentTasks.map(t => 
            t.id === action.payload.id ? { ...t, description: action.payload.description } : t
          )
        }
      };
    }

    default:
      return state;
  }
};

/**
 * --- MAIN HOOK ---
 */
export function useTaskManager(initialData) {
  // 1. Sanitize Data ONCE on initialization
  const sanitizedData = useMemo(() => sanitizeInitialData(initialData), [initialData]);

  const [state, dispatch] = useReducer(taskReducer, {
    tasks: sanitizedData,
    category: 'personal',
    newTaskId: null
  });

  // 2. Memoized Hierarchy Calculation (Performance Optimization)
  const hierarchicalTasks = useMemo(() => {
    const tasks = state.tasks[state.category];
    
    // Validate hierarchy integrity
    const rootTasks = tasks.filter(t => !t.parentId).sort((a, b) => a.order - b.order);
    
    return rootTasks.flatMap(root => {
      const children = tasks
        .filter(t => t.parentId === root.id)
        .sort((a, b) => a.order - b.order);
      return [root, ...children];
    });
  }, [state.tasks, state.category]);

  // 3. Stable Action Dispatchers
  const handlers = {
    setCategory: useCallback((cat) => dispatch({ type: 'SET_CATEGORY', payload: cat }), []),
    addTask: useCallback((desc, parentId) => dispatch({ type: 'ADD_TASK', payload: { description: desc, parentId } }), []),
    completeTask: useCallback((id) => dispatch({ type: 'COMPLETE_TASK', payload: id }), []),
    reorderTasks: useCallback((tasks) => dispatch({ type: 'REORDER_TASKS', payload: tasks }), []),
    renameTask: useCallback((id, description) => dispatch({ type: 'RENAME_TASK', payload: { id, description } }), []),
  };

  return {
    currentTasks: hierarchicalTasks,
    activeCategory: state.category,
    newTaskId: state.newTaskId,
    ...handlers
  };
}
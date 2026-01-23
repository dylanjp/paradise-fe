/**
 * TaskService - Frontend service module for backend API communication
 * Handles all HTTP requests to the Java Spring Boot backend for task operations
 *
 * Updated to use apiClient with JWT authentication instead of Basic Auth
 * Requirements: 5.1, 5.4
 */

import apiClient from "./apiClient";

/**
 * Constructs an API endpoint path for the given user and endpoint
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint path (e.g., 'tasks', 'tasks/todo', 'tasks/daily')
 * @returns {string} Full endpoint path for the API
 */
export function buildApiEndpoint(userId, endpoint) {
  const cleanEndpoint = endpoint.replace(/^\/+/, ""); // Remove leading slashes
  return `/users/${userId}/${cleanEndpoint}`;
}

/**
 * @typedef {Object} TodoTask
 * @property {string} id - Unique task identifier
 * @property {string} description - Task description
 * @property {string} category - 'personal' or 'work'
 * @property {boolean} completed - Completion status
 * @property {number} order - Display order
 * @property {string} [parentId] - Optional parent task ID for hierarchy
 */

/**
 * @typedef {Object} DailyTask
 * @property {string} id - Unique task identifier
 * @property {string} description - Task description
 * @property {boolean} completed - Completion status
 * @property {number} order - Display order
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} UserTasksResponse
 * @property {Object} todoTasks - TODO tasks grouped by category
 * @property {TodoTask[]} todoTasks.personal - Personal category tasks
 * @property {TodoTask[]} todoTasks.work - Work category tasks
 * @property {DailyTask[]} dailyTasks - Daily tasks array
 */

/**
 * Handles API errors and transforms them into user-friendly messages
 * @param {Error} error - The error object
 * @param {string} operation - Description of the operation that failed
 * @returns {Error} Transformed error with user-friendly message
 */
function handleApiError(error, operation) {
  // Handle network errors
  if (error.name === "TypeError" && error.message === "Failed to fetch") {
    return new Error(
      "Unable to connect to server. Please check that the EPIC-SERVER is running",
    );
  }

  // Handle API client errors with status codes
  if (error.status === 404) {
    return new Error("Task not found. It may have been deleted.");
  }

  if (error.status === 400) {
    return new Error(`Invalid request: ${error.message}`);
  }

  if (error.status === 401) {
    return new Error("Session expired. Please log in again.");
  }

  if (error.status === 403) {
    return new Error("You do not have permission to perform this action.");
  }

  if (error.status >= 500) {
    return new Error("Server error. Please try again later.");
  }

  return new Error(`Failed to ${operation}. Please try again.`);
}

/**
 * Parses the backend response into grouped TODO tasks and daily tasks
 * @param {Object} response - Raw backend response
 * @returns {UserTasksResponse} Parsed response with grouped tasks
 */
export function parseTasksResponse(response) {
  const todoTasks = {
    personal: [],
    work: [],
  };
  const dailyTasks = [];

  // Parse TODO tasks grouped by category
  if (response.todoTasks) {
    if (Array.isArray(response.todoTasks.personal)) {
      todoTasks.personal = response.todoTasks.personal;
    }
    if (Array.isArray(response.todoTasks.work)) {
      todoTasks.work = response.todoTasks.work;
    }
  }

  // Parse daily tasks
  if (Array.isArray(response.dailyTasks)) {
    dailyTasks.push(...response.dailyTasks);
  }

  return { todoTasks, dailyTasks };
}

export const TaskService = {
  /**
   * Fetches all tasks for a user
   * @param {string} userId - User identifier
   * @returns {Promise<UserTasksResponse>}
   */
  getAllTasks: async (userId) => {
    const endpoint = buildApiEndpoint(userId, "tasks");

    try {
      const data = await apiClient.get(endpoint);
      return parseTasksResponse(data);
    } catch (error) {
      throw handleApiError(error, "fetch tasks");
    }
  },

  /**
   * Creates a new TODO task
   * @param {string} userId - User identifier
   * @param {Object} task - Task data with id, description, category, order, and optional parentId
   * @returns {Promise<TodoTask>}
   */
  createTodoTask: async (userId, task) => {
    const endpoint = buildApiEndpoint(userId, "tasks/todo");

    const requestBody = {
      id: task.id,
      description: task.description,
      category: task.category,
      order: task.order,
    };

    // Include parentId only if provided
    if (task.parentId) {
      requestBody.parentId = task.parentId;
    }

    try {
      return await apiClient.post(endpoint, requestBody);
    } catch (error) {
      throw handleApiError(error, "create TODO task");
    }
  },

  /**
   * Creates a new Daily task
   * @param {string} userId - User identifier
   * @param {Object} task - Task data with id, description, and order
   * @returns {Promise<DailyTask>}
   */
  createDailyTask: async (userId, task) => {
    const endpoint = buildApiEndpoint(userId, "tasks/daily");

    const requestBody = {
      id: task.id,
      description: task.description,
      order: task.order,
    };

    try {
      return await apiClient.post(endpoint, requestBody);
    } catch (error) {
      throw handleApiError(error, "create daily task");
    }
  },

  /**
   * Updates an existing TODO task
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @param {Partial<TodoTask>} updates - Fields to update
   * @returns {Promise<TodoTask>}
   */
  updateTodoTask: async (userId, taskId, updates) => {
    const endpoint = buildApiEndpoint(userId, `tasks/todo/${taskId}`);

    try {
      return await apiClient.put(endpoint, updates);
    } catch (error) {
      throw handleApiError(error, "update TODO task");
    }
  },

  /**
   * Updates an existing Daily task
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @param {Partial<DailyTask>} updates - Fields to update
   * @returns {Promise<DailyTask>}
   */
  updateDailyTask: async (userId, taskId, updates) => {
    const endpoint = buildApiEndpoint(userId, `tasks/daily/${taskId}`);

    try {
      return await apiClient.put(endpoint, updates);
    } catch (error) {
      throw handleApiError(error, "update daily task");
    }
  },

  /**
   * Deletes a TODO task and its children
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  deleteTodoTask: async (userId, taskId) => {
    const endpoint = buildApiEndpoint(userId, `tasks/todo/${taskId}`);

    try {
      await apiClient.delete(endpoint);
    } catch (error) {
      throw handleApiError(error, "delete TODO task");
    }
  },

  /**
   * Deletes a Daily task
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  deleteDailyTask: async (userId, taskId) => {
    const endpoint = buildApiEndpoint(userId, `tasks/daily/${taskId}`);

    try {
      await apiClient.delete(endpoint);
    } catch (error) {
      throw handleApiError(error, "delete daily task");
    }
  },

  /**
   * Fetches completion history for a daily task
   * @param {string} userId - User identifier
   * @param {string} taskId - Daily task identifier
   * @returns {Promise<string[]>} Array of ISO date strings (YYYY-MM-DD)
   */
  getDailyTaskCompletions: async (userId, taskId) => {
    const endpoint = buildApiEndpoint(userId, `tasks/daily/${taskId}/completions`);

    try {
      const data = await apiClient.get(endpoint);
      return data;
    } catch (error) {
      throw handleApiError(error, "fetch completion history");
    }
  },

  /**
   * Fetches perfect days for a user in a given year
   * A perfect day is a date where the user completed ALL daily tasks
   * @param {string} userId - User identifier
   * @param {number} [year] - Year to fetch (defaults to current year on backend)
   * @returns {Promise<string[]>} Array of ISO date strings (YYYY-MM-DD)
   * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  getPerfectDays: async (userId, year) => {
    const endpoint = buildApiEndpoint(userId, "tasks/daily/perfect-days");
    const params = year ? `?year=${year}` : "";

    try {
      const data = await apiClient.get(`${endpoint}${params}`);
      return data || [];
    } catch (error) {
      // Handle 400 Bad Request specifically for perfect days - Requirements: 2.4
      if (error.status === 400) {
        throw new Error("Invalid year selected. Please choose a valid year.");
      }
      throw handleApiError(error, "fetch perfect days");
    }
  },
};

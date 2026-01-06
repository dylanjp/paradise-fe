/**
 * TaskService - Frontend service module for backend API communication
 * Handles all HTTP requests to the Java Spring Boot backend for task operations
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL || 'http://localhost:8080';
const API_USERNAME = process.env.NEXT_PUBLIC_PARADISE_API_USERNAME || 'user';
const API_PASSWORD = process.env.NEXT_PUBLIC_PARADISE_API_PASSWORD || '';

/**
 * Creates the Authorization header for Basic Auth
 * @returns {string} Base64 encoded credentials for Basic Auth
 */
function getAuthHeader() {
  const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);
  return `Basic ${credentials}`;
}

/**
 * Constructs a full API URL for the given endpoint
 * @param {string} userId - User identifier
 * @param {string} endpoint - API endpoint path (e.g., 'tasks', 'tasks/todo', 'tasks/daily')
 * @returns {string} Full URL for the API endpoint
 */
export function buildApiUrl(userId, endpoint) {
  const baseUrl = API_BASE_URL.replace(/\/+$/, ''); // Remove trailing slashes
  const cleanEndpoint = endpoint.replace(/^\/+/, ''); // Remove leading slashes
  return `${baseUrl}/users/${userId}/${cleanEndpoint}`;
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
  if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
    return new Error('Unable to connect to server. Please check your connection.');
  }

  if (error.status === 404) {
    return new Error('Task not found. It may have been deleted.');
  }

  if (error.status === 400) {
    return new Error(`Invalid request: ${error.message}`);
  }

  if (error.status >= 500) {
    return new Error('Server error. Please try again later.');
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
    work: []
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
    const url = buildApiUrl(userId, 'tasks');
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      const data = await response.json();
      return parseTasksResponse(data);
    } catch (error) {
      throw handleApiError(error, 'fetch tasks');
    }
  },

  /**
   * Creates a new TODO task
   * @param {string} userId - User identifier
   * @param {Object} task - Task data with id, description, category, order, and optional parentId
   * @returns {Promise<TodoTask>}
   */
  createTodoTask: async (userId, task) => {
    const url = buildApiUrl(userId, 'tasks/todo');
    
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
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw handleApiError(error, 'create TODO task');
    }
  },

  /**
   * Creates a new Daily task
   * @param {string} userId - User identifier
   * @param {Object} task - Task data with id, description, and order
   * @returns {Promise<DailyTask>}
   */
  createDailyTask: async (userId, task) => {
    const url = buildApiUrl(userId, 'tasks/daily');
    
    const requestBody = {
      id: task.id,
      description: task.description,
      order: task.order,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw handleApiError(error, 'create daily task');
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
    const url = buildApiUrl(userId, `tasks/todo/${taskId}`);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw handleApiError(error, 'update TODO task');
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
    const url = buildApiUrl(userId, `tasks/daily/${taskId}`);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      throw handleApiError(error, 'update daily task');
    }
  },

  /**
   * Deletes a TODO task and its children
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  deleteTodoTask: async (userId, taskId) => {
    const url = buildApiUrl(userId, `tasks/todo/${taskId}`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }
    } catch (error) {
      throw handleApiError(error, 'delete TODO task');
    }
  },

  /**
   * Deletes a Daily task
   * @param {string} userId - User identifier
   * @param {string} taskId - Task identifier
   * @returns {Promise<void>}
   */
  deleteDailyTask: async (userId, taskId) => {
    const url = buildApiUrl(userId, `tasks/daily/${taskId}`);

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
      }
    } catch (error) {
      throw handleApiError(error, 'delete daily task');
    }
  },
};

// Export the base URL for testing purposes
export { API_BASE_URL };

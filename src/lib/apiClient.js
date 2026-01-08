/**
 * API Client Module
 * Centralized HTTP client with automatic JWT token attachment and error handling.
 *
 * Requirements: 1.4, 1.6, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { getToken, clearToken } from "./tokenStorage";

// API base URL from environment variables (Requirement 5.5)
const API_BASE_URL = process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL || "";

// Logout callback - will be set by AuthContext
let logoutCallback = null;

/**
 * Sets the logout callback function to be called on 401 responses
 * This allows the API client to trigger logout without circular dependencies
 * @param {Function} callback - Logout function from AuthContext
 */
export function setLogoutCallback(callback) {
  logoutCallback = callback;
}

/**
 * Clears the logout callback (useful for cleanup/testing)
 */
export function clearLogoutCallback() {
  logoutCallback = null;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Custom error class for authentication errors (401)
 */
export class AuthenticationError extends ApiError {
  constructor(message = "Session expired") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

/**
 * Custom error class for authorization errors (403)
 */
export class AuthorizationError extends ApiError {
  constructor(message = "Access denied") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

/**
 * Builds headers for API requests, including Authorization header with JWT
 * Requirement 1.4, 5.1: Attach JWT to all requests as "Authorization: Bearer <token>"
 * @param {object} additionalHeaders - Additional headers to include
 * @returns {object} Headers object
 */
function buildHeaders(additionalHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...additionalHeaders,
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Handles API response errors
 * Requirement 1.6, 2.4, 5.2: Handle 401 by triggering logout
 * Requirement 5.3: Handle 403 by passing error to caller
 * @param {Response} response - Fetch response object
 * @throws {ApiError} Appropriate error based on status code
 */
async function handleResponseError(response) {
  // Handle 401 Unauthorized (Requirement 1.6, 2.4, 5.2)
  if (response.status === 401) {
    // Clear token and trigger logout
    clearToken();
    if (logoutCallback) {
      logoutCallback();
    }
    throw new AuthenticationError("Session expired");
  }

  // Handle 403 Forbidden (Requirement 5.3)
  if (response.status === 403) {
    throw new AuthorizationError("Access denied");
  }

  // Handle other errors
  let errorMessage = "An error occurred";
  let errorData = null;

  try {
    errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
  } catch {
    // Response might not be JSON
    try {
      errorMessage = await response.text();
    } catch {
      // Use default message
    }
  }

  throw new ApiError(errorMessage, response.status, errorData);
}

/**
 * Makes an authenticated API request
 * @param {string} endpoint - API endpoint (relative to base URL)
 * @param {object} options - Fetch options
 * @returns {Promise<any>} Response data
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    ...options,
    headers: buildHeaders(options.headers),
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    await handleResponseError(response);
  }

  // Handle empty responses (e.g., 204 No Content)
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return null;
  }

  // Try to parse JSON response
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * GET request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<any>} Response data
 */
export async function get(endpoint) {
  return request(endpoint, { method: "GET" });
}

/**
 * POST request
 * @param {string} endpoint - API endpoint
 * @param {any} data - Request body data
 * @returns {Promise<any>} Response data
 */
export async function post(endpoint, data) {
  return request(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 * @param {string} endpoint - API endpoint
 * @param {any} data - Request body data
 * @returns {Promise<any>} Response data
 */
export async function put(endpoint, data) {
  return request(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 * @param {string} endpoint - API endpoint
 * @returns {Promise<void>}
 */
export async function del(endpoint) {
  return request(endpoint, { method: "DELETE" });
}

// Export as default object for convenience
const apiClient = {
  get,
  post,
  put,
  delete: del,
  setLogoutCallback,
  clearLogoutCallback,
  ApiError,
  AuthenticationError,
  AuthorizationError,
};

export default apiClient;

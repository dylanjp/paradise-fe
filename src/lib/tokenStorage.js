/**
 * Token Storage Module
 * Provides secure JWT token storage with in-memory primary storage
 * and localStorage fallback for persistence across page refreshes.
 *
 * Requirements: 1.2, 1.3, 2.3, 2.5
 */

const TOKEN_KEY = "paradise_auth_token";

// In-memory storage (primary)
let inMemoryToken = null;

/**
 * Decodes a JWT token payload (base64url decoding)
 * @param {string} token - JWT token string
 * @returns {object|null} Decoded payload or null if invalid
 */
export function decodeJWT(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Handle base64url encoding (replace - with + and _ with /)
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Pad with = if needed
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    // Decode base64
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/**
 * Stores a JWT token (in-memory primary, localStorage fallback)
 * @param {string} token - JWT token to store
 */
export function setToken(token) {
  if (!token || typeof token !== "string") {
    return;
  }

  // Store in memory (primary)
  inMemoryToken = token;

  // Store in localStorage (fallback for page refresh)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // localStorage might be unavailable or full
    }
  }
}

/**
 * Retrieves the stored JWT token
 * Checks in-memory first, falls back to localStorage
 * @returns {string|null} The stored token or null
 */
export function getToken() {
  // Check in-memory first (primary)
  if (inMemoryToken) {
    return inMemoryToken;
  }

  // Fallback to localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        // Restore to in-memory for faster subsequent access
        inMemoryToken = storedToken;
        return storedToken;
      }
    } catch {
      // localStorage might be unavailable
    }
  }

  return null;
}

/**
 * Clears the stored JWT token from all storage locations
 */
export function clearToken() {
  // Clear in-memory
  inMemoryToken = null;

  // Clear localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // localStorage might be unavailable
    }
  }
}

/**
 * Checks if the stored token is expired
 * @returns {boolean} True if token is expired or invalid, false otherwise
 */
export function isTokenExpired() {
  const token = getToken();
  if (!token) {
    return true;
  }

  const payload = decodeJWT(token);
  if (!payload || typeof payload.exp !== "number") {
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const currentTime = Math.floor(Date.now() / 1000);
  return payload.exp <= currentTime;
}

/**
 * Clears only the in-memory token storage
 * Useful for testing localStorage fallback behavior
 */
export function clearInMemoryToken() {
  inMemoryToken = null;
}

"use client";

/**
 * Auth Context Module
 * Provides centralized authentication state management using React Context.
 *
 * Requirements: 1.1, 1.5, 2.1, 2.2, 7.1, 7.2, 7.3, 7.4
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  setToken,
  getToken,
  clearToken,
  decodeJWT,
  isTokenExpired,
} from "../lib/tokenStorage";

// Create the Auth Context
const AuthContext = createContext(null);

// API base URL from environment variables
const API_BASE_URL = process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL || "";

/**
 * AuthProvider component that wraps the application and provides auth state
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState(null);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Extracts user info from a JWT token and updates state
   * @param {string} token - JWT token
   * @returns {boolean} True if token was valid and state was updated
   */
  const updateStateFromToken = useCallback((token) => {
    if (!token) {
      return false;
    }

    const payload = decodeJWT(token);
    if (!payload || !payload.sub) {
      return false;
    }

    setUsername(payload.sub);

    // Support multiple role claim formats from different backends
    // Common formats: roles, authorities, scope, realm_access.roles
    let extractedRoles = [];
    if (Array.isArray(payload.roles)) {
      extractedRoles = payload.roles;
    } else if (Array.isArray(payload.authorities)) {
      extractedRoles = payload.authorities;
    } else if (payload.scope && typeof payload.scope === "string") {
      // Some backends use space-separated scopes
      extractedRoles = payload.scope
        .split(" ")
        .filter((s) => s.startsWith("ROLE_"));
    } else if (
      payload.realm_access &&
      Array.isArray(payload.realm_access.roles)
    ) {
      // Keycloak format
      extractedRoles = payload.realm_access.roles;
    }

    setRoles(extractedRoles);
    setIsAuthenticated(true);
    return true;
  }, []);

  /**
   * Clears all authentication state
   * Requirement 1.5: logout clears stored JWT and resets authentication state
   */
  const clearAuthState = useCallback(() => {
    clearToken();
    setIsAuthenticated(false);
    setUsername(null);
    setRoles([]);
  }, []);

  /**
   * Login function - sends credentials to API and stores token on success
   * Requirement 1.1: POST request to /auth/login with username and password
   * @param {string} userCredentials - Username
   * @param {string} password - Password
   * @returns {Promise<{success: boolean, error?: string}>} Login result
   */
  const login = useCallback(
    async (userCredentials, password) => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: userCredentials,
            password: password,
          }),
        });

        if (!response.ok) {
          // Return generic error message (Requirement 4.3)
          return {
            success: false,
            error: "Invalid username or password",
          };
        }

        const data = await response.json();
        const token = data.token;

        if (!token) {
          return {
            success: false,
            error: "Invalid response from server",
          };
        }

        // Store the token (Requirement 1.2, 1.3)
        setToken(token);

        // Update state from token (Requirement 2.1)
        const stateUpdated = updateStateFromToken(token);
        if (!stateUpdated) {
          clearToken();
          return {
            success: false,
            error: "Invalid token received",
          };
        }

        return { success: true };
      } catch (error) {
        // Network or other errors - return generic message (Requirement 8.4)
        return {
          success: false,
          error: "Unable to connect. Please try again.",
        };
      }
    },
    [updateStateFromToken],
  );

  /**
   * Logout function - clears token and resets state
   * Requirement 1.5: Clear stored JWT and reset authentication state
   */
  const logout = useCallback(() => {
    clearAuthState();
  }, [clearAuthState]);

  /**
   * Check if user has a specific role
   * @param {string} role - Role to check
   * @returns {boolean} True if user has the role
   */
  const hasRole = useCallback(
    (role) => {
      return roles.includes(role);
    },
    [roles],
  );

  /**
   * Check if user is an admin
   * @returns {boolean} True if user has ROLE_ADMIN
   */
  const isAdmin = useCallback(() => {
    return roles.includes("ROLE_ADMIN");
  }, [roles]);

  /**
   * Session restoration on mount
   * Requirement 2.2: Check for existing valid token and restore session
   * Requirement 7.4: Attempt to restore authentication state from Token_Storage
   */
  useEffect(() => {
    const restoreSession = () => {
      setIsLoading(true);

      try {
        // Check if there's a stored token
        const token = getToken();

        if (!token) {
          setIsLoading(false);
          return;
        }

        // Check if token is expired (Requirement 2.3)
        if (isTokenExpired()) {
          clearAuthState();
          setIsLoading(false);
          return;
        }

        // Restore state from valid token
        const restored = updateStateFromToken(token);
        if (!restored) {
          clearAuthState();
        }
      } catch {
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [updateStateFromToken, clearAuthState]);

  // Context value with all state and functions
  const contextValue = {
    // State (Requirement 7.1)
    isAuthenticated,
    username,
    roles,
    isLoading,
    // Functions (Requirement 7.3)
    login,
    logout,
    hasRole,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * Custom hook to access auth context
 * @returns {object} Auth context value
 * @throws {Error} If used outside of AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}

/**
 * Export for testing purposes - allows creating auth state objects
 * @param {object} overrides - State overrides
 * @returns {object} Auth state object
 */
export function createAuthState(overrides = {}) {
  return {
    isAuthenticated: false,
    username: null,
    roles: [],
    isLoading: false,
    login: async () => ({ success: false }),
    logout: () => {},
    hasRole: () => false,
    isAdmin: () => false,
    ...overrides,
  };
}

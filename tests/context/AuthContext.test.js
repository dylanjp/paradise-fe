/**
 * Property-Based Tests for Auth Context
 * Feature: user-authentication
 *
 * Uses fast-check for property-based testing to verify universal properties
 * across many generated inputs.
 */

import { test, fc } from "@fast-check/jest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  AuthProvider,
  useAuth,
  createAuthState,
} from "../../src/context/AuthContext";
import {
  setToken,
  getToken,
  clearToken,
  clearInMemoryToken,
} from "../../src/lib/tokenStorage";

// Helper to create a valid JWT structure
function createJWT(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodeBase64Url = (obj) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const headerEncoded = encodeBase64Url(header);
  const payloadEncoded = encodeBase64Url(payload);
  const signature = "test_signature";
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// Helper to create a valid non-expired JWT
function createValidJWT(username, roles) {
  const currentTime = Math.floor(Date.now() / 1000);
  return createJWT({
    sub: username,
    roles: roles,
    exp: currentTime + 3600, // 1 hour from now
    iat: currentTime,
  });
}

// Helper to create an expired JWT
function createExpiredJWT(username, roles) {
  const currentTime = Math.floor(Date.now() / 1000);
  return createJWT({
    sub: username,
    roles: roles,
    exp: currentTime - 3600, // 1 hour ago
    iat: currentTime - 7200,
  });
}

// Wrapper component for testing hooks
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

// Clear storage before each test
beforeEach(() => {
  clearToken();
});

describe("Auth Context - Logout State Clearing", () => {
  /**
   * Feature: user-authentication, Property 5: Logout Clears Authentication State
   * For any authenticated state (where isAuthenticated is true and a token is stored),
   * calling the logout function should result in: the token being cleared from storage,
   * isAuthenticated being false, username being null, and roles being an empty array.
   * Validates: Requirements 1.5
   */
  test.prop(
    [
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
        minLength: 1,
        maxLength: 3,
      }),
    ],
    { numRuns: 100 },
  )(
    "Property 5: Logout clears all authentication state",
    async (username, roles) => {
      // Setup: Create and store a valid token to simulate authenticated state
      const token = createValidJWT(username, roles);
      setToken(token);

      // Render the hook with the provider
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for session restoration to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify we're authenticated before logout
      expect(result.current.isAuthenticated).toBe(true);
      expect(getToken()).toBe(token);

      // Act: Call logout
      act(() => {
        result.current.logout();
      });

      // Assert: All state should be cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.username).toBeNull();
      expect(result.current.roles).toEqual([]);
      expect(getToken()).toBeNull();
    },
  );

  /**
   * Feature: user-authentication, Property 5: Logout Clears Authentication State
   * Additional test: Logout should work even when called multiple times
   * Validates: Requirements 1.5
   */
  test.prop(
    [
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
        minLength: 1,
        maxLength: 3,
      }),
      fc.integer({ min: 1, max: 5 }), // Number of times to call logout
    ],
    { numRuns: 100 },
  )(
    "Property 5: Multiple logout calls maintain cleared state",
    async (username, roles, logoutCount) => {
      // Setup: Create and store a valid token
      const token = createValidJWT(username, roles);
      setToken(token);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call logout multiple times
      for (let i = 0; i < logoutCount; i++) {
        act(() => {
          result.current.logout();
        });
      }

      // State should remain cleared
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.username).toBeNull();
      expect(result.current.roles).toEqual([]);
      expect(getToken()).toBeNull();
    },
  );
});

describe("Auth Context - Session Restoration", () => {
  /**
   * Feature: user-authentication, Property 13: Session Restoration on Application Load
   * For any valid, non-expired token stored in Token_Storage, when the application
   * initializes, the Auth_Context should restore the authentication state by decoding
   * the token and setting isAuthenticated to true with the correct username and roles.
   * Validates: Requirements 2.2, 7.4
   */
  test.prop(
    [
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
        minLength: 1,
        maxLength: 3,
      }),
    ],
    { numRuns: 100 },
  )(
    "Property 13: Session restoration restores correct state from valid token",
    async (username, roles) => {
      // Setup: Store a valid token BEFORE rendering the hook
      const token = createValidJWT(username, roles);
      setToken(token);

      // Render the hook - this should trigger session restoration
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Assert: State should be restored from the token
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.username).toBe(username);
      expect(result.current.roles).toEqual(roles);
    },
  );

  /**
   * Feature: user-authentication, Property 13: Session Restoration on Application Load
   * Additional test: Expired tokens should NOT restore session
   * Validates: Requirements 2.2, 2.3, 7.4
   */
  test.prop(
    [
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
        minLength: 1,
        maxLength: 3,
      }),
    ],
    { numRuns: 100 },
  )(
    "Property 13: Session restoration rejects expired tokens",
    async (username, roles) => {
      // Setup: Store an expired token
      const token = createExpiredJWT(username, roles);
      setToken(token);

      // Render the hook
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Assert: State should NOT be restored (token is expired)
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.username).toBeNull();
      expect(result.current.roles).toEqual([]);
      // Token should be cleared
      expect(getToken()).toBeNull();
    },
  );

  /**
   * Feature: user-authentication, Property 13: Session Restoration on Application Load
   * Additional test: No token means no session restoration
   * Validates: Requirements 2.2, 7.4
   */
  test("Property 13: No token results in unauthenticated state", async () => {
    // Ensure no token is stored
    clearToken();

    // Render the hook
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Assert: Should be unauthenticated
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.username).toBeNull();
    expect(result.current.roles).toEqual([]);
  });
});

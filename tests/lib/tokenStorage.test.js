/**
 * Property-Based Tests for Token Storage
 * Feature: user-authentication
 *
 * Uses fast-check for property-based testing to verify universal properties
 * across many generated inputs.
 */

import { test, fc } from "@fast-check/jest";
import {
  setToken,
  getToken,
  clearToken,
  clearInMemoryToken,
  decodeJWT,
  isTokenExpired,
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

// Clear storage before each test
beforeEach(() => {
  clearToken();
});

describe("Token Storage", () => {
  /**
   * Feature: user-authentication, Property 1: Token Storage Round-Trip
   * For any valid JWT token string, storing it in Token_Storage and then
   * retrieving it should return the exact same token string.
   * Validates: Requirements 1.2, 1.3
   */
  test.prop(
    [
      fc.record({
        sub: fc.string({ minLength: 1, maxLength: 50 }),
        roles: fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
          minLength: 1,
          maxLength: 3,
        }),
        exp: fc.integer({ min: 1, max: 2147483647 }),
        iat: fc.integer({ min: 1, max: 2147483647 }),
      }),
    ],
    { numRuns: 100 },
  )("Property 1: Token storage round-trip preserves token value", (payload) => {
    const token = createJWT(payload);

    // Store the token
    setToken(token);

    // Retrieve and verify it's the same
    const retrieved = getToken();
    expect(retrieved).toBe(token);
  });

  /**
   * Feature: user-authentication, Property 1: Token Storage Round-Trip (localStorage fallback)
   * If in-memory storage is cleared (simulating page refresh), the token
   * should still be retrievable from localStorage fallback.
   * Validates: Requirements 1.2, 1.3
   */
  test.prop(
    [
      fc.record({
        sub: fc.string({ minLength: 1, maxLength: 50 }),
        roles: fc.array(fc.constantFrom("ROLE_USER", "ROLE_ADMIN"), {
          minLength: 1,
          maxLength: 3,
        }),
        exp: fc.integer({ min: 1, max: 2147483647 }),
        iat: fc.integer({ min: 1, max: 2147483647 }),
      }),
    ],
    { numRuns: 100 },
  )(
    "Property 1: Token storage falls back to localStorage when in-memory cleared",
    (payload) => {
      const token = createJWT(payload);

      // Store the token
      setToken(token);

      // Clear only in-memory storage (simulating page refresh)
      clearInMemoryToken();

      // Should still retrieve from localStorage
      const retrieved = getToken();
      expect(retrieved).toBe(token);
    },
  );
});

describe("JWT Decoding", () => {
  /**
   * Feature: user-authentication, Property 2: JWT Decoding Extracts Correct Claims
   * For any valid JWT token containing a subject (username) and roles array,
   * decoding the token should extract the exact username and roles that were encoded.
   * Validates: Requirements 2.1, 3.1
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
    "Property 2: JWT decoding extracts correct username (sub) claim",
    (username, roles) => {
      const payload = {
        sub: username,
        roles: roles,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const token = createJWT(payload);

      const decoded = decodeJWT(token);

      expect(decoded).not.toBeNull();
      expect(decoded.sub).toBe(username);
    },
  );

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
    "Property 2: JWT decoding extracts correct roles claim",
    (username, roles) => {
      const payload = {
        sub: username,
        roles: roles,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const token = createJWT(payload);

      const decoded = decodeJWT(token);

      expect(decoded).not.toBeNull();
      expect(decoded.roles).toEqual(roles);
    },
  );
});

describe("Token Expiration", () => {
  /**
   * Feature: user-authentication, Property 6: Expired Tokens Are Rejected
   * For any JWT token with an exp claim that is in the past (expired),
   * the Token_Storage should report the token as expired.
   * Validates: Requirements 2.3
   */
  test.prop(
    [
      fc.integer({ min: 1, max: 1000000 }), // seconds in the past
    ],
    { numRuns: 100 },
  )(
    "Property 6: Expired tokens are correctly identified as expired",
    (secondsInPast) => {
      const currentTime = Math.floor(Date.now() / 1000);
      const payload = {
        sub: "testuser",
        roles: ["ROLE_USER"],
        exp: currentTime - secondsInPast, // Expired
        iat: currentTime - secondsInPast - 3600,
      };
      const token = createJWT(payload);

      setToken(token);

      expect(isTokenExpired()).toBe(true);
    },
  );

  test.prop(
    [
      fc.integer({ min: 60, max: 86400 }), // seconds in the future (1 min to 1 day)
    ],
    { numRuns: 100 },
  )(
    "Property 6: Non-expired tokens are correctly identified as valid",
    (secondsInFuture) => {
      const currentTime = Math.floor(Date.now() / 1000);
      const payload = {
        sub: "testuser",
        roles: ["ROLE_USER"],
        exp: currentTime + secondsInFuture, // Not expired
        iat: currentTime,
      };
      const token = createJWT(payload);

      setToken(token);

      expect(isTokenExpired()).toBe(false);
    },
  );
});

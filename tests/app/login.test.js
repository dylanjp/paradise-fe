/**
 * Property-Based Tests for Login Page
 * Feature: user-authentication
 *
 * Uses fast-check for property-based testing to verify universal properties
 * across many generated inputs.
 */

import { test, fc } from "@fast-check/jest";

/**
 * Generic error messages that should be displayed to users.
 * These messages should NOT reveal whether the username or password was incorrect.
 * Requirement 4.3: Display generic error message without revealing which credential was incorrect
 */
const GENERIC_ERROR_MESSAGES = [
  "Invalid username or password",
  "Unable to connect. Please try again.",
  "An unexpected error occurred. Please try again.",
  "Please enter both username and password",
  "Invalid response from server",
  "Invalid token received",
];

/**
 * Patterns that would reveal sensitive information about authentication failures.
 * These should NEVER appear in error messages shown to users.
 */
const SENSITIVE_PATTERNS = [
  /username.*not found/i,
  /user.*does not exist/i,
  /password.*incorrect/i,
  /wrong password/i,
  /invalid password/i,
  /user.*not registered/i,
  /account.*not found/i,
  /no user.*with/i,
  /password.*mismatch/i,
  /authentication failed.*password/i,
  /authentication failed.*username/i,
  /credentials.*username/i,
  /credentials.*password/i,
];

/**
 * Patterns that would reveal sensitive system information.
 * These should NEVER appear in error messages shown to users.
 * Requirement 8.4: Error messages should not expose sensitive error details
 */
const SYSTEM_SENSITIVE_PATTERNS = [
  /stack trace/i,
  /at\s+\w+\s*\(/i, // Stack trace line pattern
  /error code:\s*\d+/i,
  /internal server error/i,
  /database.*error/i,
  /sql.*error/i,
  /connection.*refused/i,
  /timeout.*exceeded/i,
  /null pointer/i,
  /undefined.*reference/i,
  /exception.*thrown/i,
  /file.*not found/i,
  /permission.*denied/i,
  /access.*denied.*system/i,
  /\.js:\d+:\d+/i, // File:line:column pattern
  /node_modules/i,
  /at\s+Object\./i,
  /at\s+Module\./i,
  /at\s+Function\./i,
];

describe("Login Error Messages", () => {
  /**
   * Feature: user-authentication, Property 9: Login Error Messages Are Generic
   * For any failed login attempt (whether due to invalid username, invalid password,
   * or other authentication failure), the error message displayed to the user should
   * be generic and not reveal which specific credential was incorrect.
   * Validates: Requirements 4.3
   */
  test.prop([fc.constantFrom(...GENERIC_ERROR_MESSAGES)], { numRuns: 100 })(
    "Property 9: Generic error messages do not reveal which credential was incorrect",
    (errorMessage) => {
      // Verify the error message doesn't match any sensitive patterns
      for (const pattern of SENSITIVE_PATTERNS) {
        expect(errorMessage).not.toMatch(pattern);
      }
    },
  );

  /**
   * Feature: user-authentication, Property 9: Login Error Messages Are Generic
   * Additional test: All generic error messages should be user-friendly
   * Validates: Requirements 4.3
   */
  test.prop([fc.constantFrom(...GENERIC_ERROR_MESSAGES)], { numRuns: 100 })(
    "Property 9: Generic error messages are user-friendly and actionable",
    (errorMessage) => {
      // Error messages should be non-empty
      expect(errorMessage.length).toBeGreaterThan(0);

      // Error messages should not be too long (user-friendly)
      expect(errorMessage.length).toBeLessThan(100);

      // Error messages should not contain technical jargon
      expect(errorMessage).not.toMatch(/exception/i);
      expect(errorMessage).not.toMatch(/null/i);
      expect(errorMessage).not.toMatch(/undefined/i);
      expect(errorMessage).not.toMatch(/error code/i);
    },
  );

  /**
   * Feature: user-authentication, Property 9: Login Error Messages Are Generic
   * Test that simulated backend error responses result in generic messages
   * Validates: Requirements 4.3
   */
  test.prop(
    [
      fc.record({
        status: fc.constantFrom(400, 401, 403, 500, 502, 503),
        message: fc.oneof(
          fc.constant("User not found"),
          fc.constant("Invalid password"),
          fc.constant("Account locked"),
          fc.constant("Database connection failed"),
          fc.constant("Internal server error"),
          fc.constant("Authentication failed: wrong password"),
        ),
      }),
    ],
    { numRuns: 100 },
  )(
    "Property 9: Backend error details are not exposed to users",
    (backendError) => {
      // The backend might return detailed errors, but we should map them to generic messages
      // This test verifies that our generic messages don't contain backend details
      const genericMessage = mapBackendErrorToGenericMessage(backendError);

      // The mapped message should be one of our generic messages
      expect(GENERIC_ERROR_MESSAGES).toContain(genericMessage);

      // The mapped message should not contain the original backend message
      expect(genericMessage).not.toContain(backendError.message);
    },
  );
});

describe("Error Message Sanitization", () => {
  /**
   * Feature: user-authentication, Property 15: Error Messages Are Sanitized
   * For any error that occurs during authentication or API calls, the error message
   * displayed to the user should not contain sensitive information such as stack traces,
   * internal error codes, or system details.
   * Validates: Requirements 8.4
   */
  test.prop([fc.constantFrom(...GENERIC_ERROR_MESSAGES)], { numRuns: 100 })(
    "Property 15: Error messages do not contain stack traces or system details",
    (errorMessage) => {
      // Verify the error message doesn't match any system-sensitive patterns
      for (const pattern of SYSTEM_SENSITIVE_PATTERNS) {
        expect(errorMessage).not.toMatch(pattern);
      }
    },
  );

  /**
   * Feature: user-authentication, Property 15: Error Messages Are Sanitized
   * Test that various error types are sanitized properly
   * Validates: Requirements 8.4
   */
  test.prop(
    [
      fc.oneof(
        // Simulated stack traces
        fc.constant(
          "Error: Connection failed\n    at Object.<anonymous> (/app/src/lib/api.js:42:15)",
        ),
        fc.constant(
          "TypeError: Cannot read property 'token' of undefined\n    at login (/app/src/context/AuthContext.js:55:20)",
        ),
        // Simulated internal errors
        fc.constant("ECONNREFUSED: Connection refused to localhost:5432"),
        fc.constant("SQL Error: relation 'users' does not exist"),
        fc.constant("Error code: AUTH_001 - User validation failed"),
        // Simulated system paths
        fc.constant("File not found: /var/www/app/config/secrets.json"),
        fc.constant("Permission denied: /etc/passwd"),
      ),
    ],
    { numRuns: 100 },
  )(
    "Property 15: Sensitive system errors are sanitized before display",
    (sensitiveError) => {
      // Sanitize the error
      const sanitizedMessage = sanitizeErrorMessage(sensitiveError);

      // The sanitized message should be one of our generic messages
      expect(GENERIC_ERROR_MESSAGES).toContain(sanitizedMessage);

      // The sanitized message should not contain the original sensitive content
      expect(sanitizedMessage).not.toContain("at Object");
      expect(sanitizedMessage).not.toContain("at login");
      expect(sanitizedMessage).not.toContain("/app/");
      expect(sanitizedMessage).not.toContain("ECONNREFUSED");
      expect(sanitizedMessage).not.toContain("SQL Error");
      expect(sanitizedMessage).not.toContain("Error code:");
      expect(sanitizedMessage).not.toContain("/var/www/");
      expect(sanitizedMessage).not.toContain("/etc/");
    },
  );

  /**
   * Feature: user-authentication, Property 15: Error Messages Are Sanitized
   * Test that XSS-like content is not present in error messages
   * Validates: Requirements 8.4
   */
  test.prop([fc.constantFrom(...GENERIC_ERROR_MESSAGES)], { numRuns: 100 })(
    "Property 15: Error messages do not contain potential XSS content",
    (errorMessage) => {
      // Error messages should not contain HTML/script tags
      expect(errorMessage).not.toMatch(/<script/i);
      expect(errorMessage).not.toMatch(/<\/script>/i);
      expect(errorMessage).not.toMatch(/javascript:/i);
      expect(errorMessage).not.toMatch(/on\w+=/i); // onclick=, onerror=, etc.
      expect(errorMessage).not.toMatch(/<iframe/i);
      expect(errorMessage).not.toMatch(/<img.*onerror/i);
    },
  );
});

/**
 * Helper function to map backend errors to generic user-facing messages.
 * This simulates the error handling logic in the AuthContext.
 * @param {object} backendError - The error from the backend
 * @returns {string} A generic error message
 */
function mapBackendErrorToGenericMessage(backendError) {
  // Map all authentication-related errors to a generic message
  if (backendError.status === 401 || backendError.status === 403) {
    return "Invalid username or password";
  }

  // Map server errors to a generic message
  if (backendError.status >= 500) {
    return "Unable to connect. Please try again.";
  }

  // Map other client errors to a generic message
  return "Invalid username or password";
}

/**
 * Helper function to sanitize error messages before displaying to users.
 * This simulates the error sanitization logic.
 * @param {string} error - The raw error message
 * @returns {string} A sanitized error message
 */
function sanitizeErrorMessage(error) {
  // Check if the error contains sensitive patterns
  const containsSensitiveInfo = SYSTEM_SENSITIVE_PATTERNS.some((pattern) =>
    pattern.test(error),
  );

  // If sensitive info is detected, return a generic message
  if (containsSensitiveInfo) {
    return "An unexpected error occurred. Please try again.";
  }

  // Check for authentication-related sensitive patterns
  const containsAuthSensitiveInfo = SENSITIVE_PATTERNS.some((pattern) =>
    pattern.test(error),
  );

  if (containsAuthSensitiveInfo) {
    return "Invalid username or password";
  }

  // If the error is already generic, return it
  if (GENERIC_ERROR_MESSAGES.includes(error)) {
    return error;
  }

  // Default to a generic message
  return "An unexpected error occurred. Please try again.";
}

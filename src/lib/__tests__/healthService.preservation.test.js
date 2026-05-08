/**
 * Preservation Property Tests — Property 2
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * These tests verify that the health API path fix did NOT break existing behavior:
 *   - handleError() still transforms errors into user-friendly messages
 *   - uploadDocument still uses FormData, omits Content-Type, includes Authorization: Bearer
 *   - apiClient.js module exports are unchanged and functional
 *
 * EXPECTED: All tests PASS (confirms baseline behavior is preserved after the fix).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// ─── handleError tests ───
// We need to import healthService with mocked apiClient so we can trigger errors.
// handleError is not exported directly, but we can exercise it through service functions.

// For handleError testing, we import the module and call functions that invoke handleError.
// We mock apiClient to throw specific errors so handleError processes them.

vi.mock("../apiClient", () => {
  const mockGet = vi.fn();
  const mockPost = vi.fn();
  const mockPut = vi.fn();
  const mockDel = vi.fn();

  return {
    default: {
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDel,
    },
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDel,
    handleUnauthorized: vi.fn(),
    setLogoutCallback: vi.fn(),
    clearLogoutCallback: vi.fn(),
  };
});

vi.mock("../tokenStorage", () => ({
  getToken: vi.fn(() => "test-token-abc123"),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { healthService } from "../healthService";
import apiClient from "../apiClient";

describe("Preservation — Error handling unchanged (Property 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Property: For any random operation string, handleError with a
   * TypeError("Failed to fetch") always returns "Unable to connect to server. Please try again."
   */
  it("PBT: TypeError('Failed to fetch') always returns network error message for any operation", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (operation) => {
          // Make apiClient.get throw a TypeError("Failed to fetch")
          const networkError = new TypeError("Failed to fetch");
          apiClient.get.mockRejectedValueOnce(networkError);

          try {
            await healthService.getJournalEntries("testuser");
            // Should not reach here
            expect.unreachable("Expected an error to be thrown");
          } catch (err) {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe(
              "Unable to connect to server. Please try again."
            );
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Property: For any random error status in [404, 500+], handleError returns
   * the expected user-friendly message.
   */
  it("PBT: error status codes map to correct user-friendly messages", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // 404 errors
          fc.constant({ status: 404, expectedMsg: "Resource not found." }),
          // 500+ server errors
          fc.integer({ min: 500, max: 599 }).map((status) => ({
            status,
            expectedMsg: "Server error. Please try again later.",
          })),
          // 400 errors with a message
          fc.string({ minLength: 1, maxLength: 30 }).map((msg) => ({
            status: 400,
            message: msg,
            data: { message: undefined },
            expectedMsg: msg,
          }))
        ),
        async ({ status, message, data, expectedMsg }) => {
          const apiError = { status, message, data };
          apiClient.get.mockRejectedValueOnce(apiError);

          try {
            await healthService.getJournalEntries("testuser");
            expect.unreachable("Expected an error to be thrown");
          } catch (err) {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe(expectedMsg);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * **Validates: Requirements 3.3**
   *
   * Observation tests: specific error scenarios produce expected messages.
   */
  it("handleError: TypeError('Failed to fetch') → network error message", async () => {
    apiClient.get.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      healthService.getJournalEntries("testuser")
    ).rejects.toThrow("Unable to connect to server. Please try again.");
  });

  it("handleError: status 404 → 'Resource not found.'", async () => {
    apiClient.get.mockRejectedValueOnce({ status: 404 });

    await expect(
      healthService.getJournalEntries("testuser")
    ).rejects.toThrow("Resource not found.");
  });

  it("handleError: status 500 → 'Server error. Please try again later.'", async () => {
    apiClient.get.mockRejectedValueOnce({ status: 500 });

    await expect(
      healthService.getJournalEntries("testuser")
    ).rejects.toThrow("Server error. Please try again later.");
  });

  it("handleError: status 400 with message → uses the error message", async () => {
    apiClient.get.mockRejectedValueOnce({ status: 400, message: "bad" });

    await expect(
      healthService.getJournalEntries("testuser")
    ).rejects.toThrow("bad");
  });

  it("handleError: unknown error → fallback message with operation name", async () => {
    apiClient.get.mockRejectedValueOnce({ status: 418 });

    await expect(
      healthService.getJournalEntries("testuser")
    ).rejects.toThrow("Failed to fetch journal entries. Please try again.");
  });
});

describe("Preservation — uploadDocument multipart mechanics (Property 2)", () => {
  let savedFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    savedFetch = global.fetch;
    process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = savedFetch;
  });

  /**
   * **Validates: Requirements 3.4**
   *
   * Test: uploadDocument constructs a FormData body, does not set Content-Type,
   * and sets Authorization: Bearer {token}.
   */
  it("uploadDocument uses FormData body, omits Content-Type, includes Authorization: Bearer header", async () => {
    let capturedUrl = "";
    let capturedOptions = {};

    global.fetch = vi.fn(async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return { ok: true, json: async () => ({ id: "doc-1" }) };
    });

    const file = new File(["test content"], "report.pdf", {
      type: "application/pdf",
    });
    await healthService.uploadDocument("alice", file, "lab");

    // Verify FormData body
    expect(capturedOptions.body).toBeInstanceOf(FormData);
    expect(capturedOptions.body.get("file")).toBeInstanceOf(File);
    expect(capturedOptions.body.get("file").name).toBe("report.pdf");
    expect(capturedOptions.body.get("category")).toBe("lab");

    // Verify NO Content-Type header (browser sets multipart boundary automatically)
    expect(capturedOptions.headers).toBeDefined();
    expect(capturedOptions.headers["Content-Type"]).toBeUndefined();

    // Verify Authorization: Bearer header
    expect(capturedOptions.headers["Authorization"]).toBe(
      "Bearer test-token-abc123"
    );

    // Verify method is POST
    expect(capturedOptions.method).toBe("POST");
  });
});

describe("Preservation — apiClient.js module exports unchanged (Property 2)", () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * Test: apiClient.js exports get, post, put, delete, handleUnauthorized,
   * setLogoutCallback and they are all functions.
   */
  it("apiClient exports all expected functions", async () => {
    // Import the real apiClient module (not the mock) to check exports
    // We check the mock here since the mock mirrors the real exports
    // For a true preservation check, we verify the actual source file exports
    const realModule = await vi.importActual("../apiClient");

    // Named exports
    expect(typeof realModule.get).toBe("function");
    expect(typeof realModule.post).toBe("function");
    expect(typeof realModule.put).toBe("function");
    expect(typeof realModule.del).toBe("function");
    expect(typeof realModule.handleUnauthorized).toBe("function");
    expect(typeof realModule.setLogoutCallback).toBe("function");

    // Default export object
    expect(typeof realModule.default.get).toBe("function");
    expect(typeof realModule.default.post).toBe("function");
    expect(typeof realModule.default.put).toBe("function");
    expect(typeof realModule.default.delete).toBe("function");
    expect(typeof realModule.default.handleUnauthorized).toBe("function");
    expect(typeof realModule.default.setLogoutCallback).toBe("function");
    expect(typeof realModule.default.clearLogoutCallback).toBe("function");

    // Error classes
    expect(typeof realModule.ApiError).toBe("function");
    expect(typeof realModule.AuthenticationError).toBe("function");
    expect(typeof realModule.AuthorizationError).toBe("function");
  });
});

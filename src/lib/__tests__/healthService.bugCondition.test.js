/**
 * Bug Condition Exploration Test — Property 1
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * This property-based test verifies that all healthService functions construct
 * URLs using the user-scoped `/users/{username}/health` path pattern.
 *
 * The code has already been fixed (tasks 3.1 and 3.2 complete):
 *   - `getBase(username)` replaces the old hardcoded `const BASE = "/api/health"`
 *   - All 16 functions accept `username` as their first parameter
 *
 * EXPECTED: This test PASSES on the fixed code, confirming the fix works.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";

// Track the last URL passed to each mock
let capturedUrl = "";

vi.mock("../apiClient", () => {
  const mockGet = vi.fn(async (url) => {
    capturedUrl = url;
    return [];
  });
  const mockPost = vi.fn(async (url) => {
    capturedUrl = url;
    return {};
  });
  const mockPut = vi.fn(async (url) => {
    capturedUrl = url;
    return {};
  });
  const mockDel = vi.fn(async (url) => {
    capturedUrl = url;
    return undefined;
  });

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
  getToken: vi.fn(() => "fake-token"),
  setToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { healthService } from "../healthService";

describe("Bug Condition Exploration — Health API URLs use user-scoped path", () => {
  let savedFetch;

  beforeEach(() => {
    capturedUrl = "";
    savedFetch = global.fetch;
    // Set env var for uploadDocument (empty string so URL is just the path)
    process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL = "";
  });

  afterEach(() => {
    global.fetch = savedFetch;
    vi.clearAllMocks();
  });

  /**
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * Property: For any valid username, every apiClient-based healthService
   * function constructs a URL starting with `/users/{username}/health`.
   */
  it("Property 1: apiClient-based functions use /users/{username}/health URLs", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
        async (username) => {
          const expectedPrefix = `/users/${username}/health`;

          // Each entry: [name, call-thunk]
          const calls = [
            ["getJournalEntries", () => healthService.getJournalEntries(username)],
            ["createJournalEntry", () => healthService.createJournalEntry(username, { title: "t" })],
            ["updateJournalEntry", () => healthService.updateJournalEntry(username, "id1", { title: "u" })],
            ["deleteJournalEntry", () => healthService.deleteJournalEntry(username, "id1")],
            ["getMetrics", () => healthService.getMetrics(username)],
            ["createMetric", () => healthService.createMetric(username, { name: "w" })],
            ["addDataPoint", () => healthService.addDataPoint(username, "m1", { value: 1 })],
            ["getDocuments", () => healthService.getDocuments(username)],
            ["deleteDocument", () => healthService.deleteDocument(username, "d1")],
            ["getAppointments", () => healthService.getAppointments(username)],
            ["createAppointment", () => healthService.createAppointment(username, { doctor: "Dr. A" })],
            ["deleteAppointment", () => healthService.deleteAppointment(username, "a1")],
            ["getReminders", () => healthService.getReminders(username)],
            ["createReminder", () => healthService.createReminder(username, { text: "r" })],
            ["deleteReminder", () => healthService.deleteReminder(username, "r1")],
          ];

          for (const [name, callFn] of calls) {
            capturedUrl = "";
            await callFn();
            expect(
              capturedUrl.startsWith(expectedPrefix),
              `${name}: expected "${capturedUrl}" to start with "${expectedPrefix}"`
            ).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * **Validates: Requirements 1.2**
   *
   * Property: For any valid username, uploadDocument (which uses global fetch
   * instead of apiClient) constructs a URL containing `/users/{username}/health/documents`.
   */
  it("Property 1: uploadDocument fetch URL uses /users/{username}/health/documents", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/),
        async (username) => {
          let fetchedUrl = "";
          global.fetch = vi.fn(async (url) => {
            fetchedUrl = url;
            return { ok: true, json: async () => ({}) };
          });

          await healthService.uploadDocument(
            username,
            new File(["data"], "test.pdf"),
            "lab"
          );

          const expectedPath = `/users/${username}/health/documents`;
          expect(
            fetchedUrl.includes(expectedPath),
            `uploadDocument: expected fetch URL "${fetchedUrl}" to contain "${expectedPath}"`
          ).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });
});

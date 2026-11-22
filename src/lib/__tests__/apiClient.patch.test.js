/**
 * Tests for apiClient.patch: the backend's health appointment and reminder
 * update endpoints are PATCH-only, and the backend's CORS config allows PATCH.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import apiClient, { patch, AuthorizationError } from "../apiClient";
import { setToken, clearToken } from "../tokenStorage";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("apiClient.patch", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setToken("patch-test-token");
  });

  afterEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it("is exported both as a named export and on the default client", () => {
    expect(typeof patch).toBe("function");
    expect(apiClient.patch).toBe(patch);
  });

  it("sends a PATCH with a JSON body and the bearer token", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: "r1", completed: true }));

    const result = await patch("/users/alice/health/reminders/r1", {
      completed: true,
    });

    expect(result).toEqual({ id: "r1", completed: true });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/users/alice/health/reminders/r1");
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ completed: true });
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.headers.Authorization).toBe("Bearer patch-test-token");
  });

  it("maps a 403 to AuthorizationError like the other verbs", async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));

    await expect(
      patch("/users/alice/health/appointments/a1", { notes: "x" }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});

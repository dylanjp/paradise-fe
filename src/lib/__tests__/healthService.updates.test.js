/**
 * Tests that healthService uses the HTTP methods the backend actually maps:
 * - journal entries are saved with POST /journal (backend upserts by date; there is no PUT)
 * - appointments and reminders are updated with PATCH
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../apiClient", () => {
  const client = {
    get: vi.fn(async () => []),
    post: vi.fn(async (url, body) => ({ id: "saved", ...body })),
    put: vi.fn(async () => ({})),
    patch: vi.fn(async (url, body) => ({ id: "updated", ...body })),
    delete: vi.fn(async () => null),
  };
  return {
    default: client,
    ...client,
    handleUnauthorized: vi.fn(),
  };
});

vi.mock("../tokenStorage", () => ({
  getToken: vi.fn(() => "token"),
}));

import apiClient from "../apiClient";
import { healthService } from "../healthService";

describe("healthService update methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves journal entries with POST /journal and never PUT", async () => {
    const entry = { date: "2026-11-21", mood: 4 };
    const saved = await healthService.createJournalEntry("alice", entry);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/users/alice/health/journal",
      entry,
    );
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(saved).toMatchObject({ id: "saved", date: "2026-11-21" });
  });

  it("has no update-by-id journal call (the backend has no such route)", () => {
    expect(healthService.updateJournalEntry).toBeUndefined();
  });

  it("updates an appointment with PATCH", async () => {
    const changes = { notes: "Bring results" };
    const updated = await healthService.updateAppointment("alice", "a1", changes);

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/users/alice/health/appointments/a1",
      changes,
    );
    expect(updated).toMatchObject({ id: "updated", notes: "Bring results" });
  });

  it("updates a reminder with PATCH", async () => {
    await healthService.updateReminder("alice", "r1", { completed: true });

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/users/alice/health/reminders/r1",
      { completed: true },
    );
  });

  it("wraps PATCH failures with the service's friendly errors", async () => {
    apiClient.patch.mockRejectedValueOnce({ status: 404 });

    await expect(
      healthService.updateReminder("alice", "missing", { completed: true }),
    ).rejects.toThrow("Resource not found.");
  });
});

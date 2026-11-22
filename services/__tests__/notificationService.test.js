/**
 * Tests for notificationService error mapping against the backend's real
 * responses (paradise-be NotificationExceptionHandler):
 * - already converted to a TODO → 409 { errorCode: "ALREADY_ACTIONED" }
 * - expired notification        → 400 { errorCode: "NOTIFICATION_EXPIRED" }
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/src/lib/apiClient", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from "@/src/lib/apiClient";
import { notificationService, NotificationError } from "../notificationService";

const apiError = (status, data, message = "backend message") => ({
  status,
  data,
  message,
});

describe("notificationService error mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls POST /api/notifications/{id}/action", async () => {
    apiClient.post.mockResolvedValueOnce({ id: "todo-1" });
    await notificationService.createAction(7);
    expect(apiClient.post).toHaveBeenCalledWith("/api/notifications/7/action", {});
  });

  it("maps 409 ALREADY_ACTIONED to the 'already created' message", async () => {
    apiClient.post.mockRejectedValueOnce(
      apiError(409, { errorCode: "ALREADY_ACTIONED", message: "dup" }),
    );

    const error = await notificationService.createAction(7).catch((e) => e);

    expect(error).toBeInstanceOf(NotificationError);
    expect(error.code).toBe("ACTION_ALREADY_CREATED");
    expect(error.status).toBe(409);
    expect(error.message).toBe(
      "A TODO has already been created from this notification.",
    );
  });

  it("maps 400 NOTIFICATION_EXPIRED to the expired message", async () => {
    apiClient.post.mockRejectedValueOnce(
      apiError(400, { errorCode: "NOTIFICATION_EXPIRED", message: "expired" }),
    );

    const error = await notificationService.createAction(7).catch((e) => e);

    expect(error.code).toBe("NOTIFICATION_EXPIRED");
    expect(error.message).toBe(
      "Cannot perform this action on an expired notification.",
    );
  });

  it("passes other 400s through with the backend message", async () => {
    apiClient.post.mockRejectedValueOnce(
      apiError(400, { errorCode: "NO_ACTION_ITEM" }, "Notification has no action item"),
    );

    const error = await notificationService.createAction(7).catch((e) => e);

    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.message).toBe("Notification has no action item");
  });

  it("treats other 409s as a generic failure", async () => {
    apiClient.post.mockRejectedValueOnce(apiError(409, { errorCode: "OTHER" }));

    const error = await notificationService.createAction(7).catch((e) => e);

    expect(error.code).toBeUndefined();
    expect(error.message).toBe(
      "Failed to create TODO from notification. Please try again.",
    );
  });
});

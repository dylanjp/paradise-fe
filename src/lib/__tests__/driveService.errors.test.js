/**
 * Tests for driveService error-code handling. The backend's ErrorResponse
 * carries the code in `errorCode` (see paradise-be MyDriveExceptionHandler).
 */

import { describe, it, expect } from "vitest";
import { getErrorCode, getErrorMessage } from "../driveService";
import { ApiError } from "../apiClient";

const backendError = (status, errorCode, message = "backend message") =>
  new ApiError(message, status, {
    errorCode,
    message,
    timestamp: "2026-11-21T12:00:00",
  });

describe("getErrorCode", () => {
  it("reads errorCode from the backend ErrorResponse", () => {
    expect(getErrorCode(backendError(404, "DRIVE_ITEM_NOT_FOUND"))).toBe(
      "DRIVE_ITEM_NOT_FOUND",
    );
  });

  it("returns null when there is no response body", () => {
    expect(getErrorCode(new ApiError("x", 500, null))).toBeNull();
    expect(getErrorCode(undefined)).toBeNull();
  });
});

describe("getErrorMessage", () => {
  it("maps known backend codes to friendly messages", () => {
    expect(getErrorMessage(backendError(404, "DRIVE_ITEM_NOT_FOUND"))).toBe(
      "This item no longer exists.",
    );
    expect(getErrorMessage(backendError(400, "DOWNLOAD_FOLDER"))).toBe(
      "Folders cannot be downloaded.",
    );
  });

  it("uses the generic access-denied message for DRIVE_ACCESS_DENIED", () => {
    expect(getErrorMessage(backendError(403, "DRIVE_ACCESS_DENIED"))).toBe(
      "You do not have permission to access this drive.",
    );
  });

  it("covers both root move and root delete for DRIVE_ROOT_DELETION", () => {
    expect(getErrorMessage(backendError(400, "DRIVE_ROOT_DELETION"))).toBe(
      "The root folder cannot be moved or deleted.",
    );
  });

  it("falls back to the backend message for unknown codes", () => {
    expect(
      getErrorMessage(backendError(400, "SOMETHING_NEW", "Specific problem")),
    ).toBe("Specific problem");
  });

  it("falls back to a generic message when nothing is available", () => {
    expect(getErrorMessage({})).toBe("An unexpected error occurred.");
  });
});

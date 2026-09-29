/**
 * Drive Service Module
 * Encapsulates all MyDrive API endpoint calls.
 * Delegates to apiClient for JSON requests, uses fetch directly for multipart uploads.
 * All functions require a userId parameter — sourced from the authenticated user's identity.
 */

import * as apiClient from "./apiClient";
import { getToken } from "./tokenStorage";

const API_BASE_URL = process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL || "";

const ERROR_MESSAGES = {
  DRIVE_ACCESS_DENIED: "You do not have permission to access this drive.",
  INVALID_DRIVE_KEY: "The selected drive is not valid.",
  DRIVE_ITEM_NOT_FOUND: "This item no longer exists.",
  DRIVE_UNAVAILABLE:
    "The drive service is temporarily unavailable. Please try again later.",
  DRIVE_ITEM_CONFLICT:
    "An item with that name already exists in the destination folder, or the move would create a circular reference.",
  DRIVE_ROOT_DELETION: "The root folder cannot be deleted.",
  DRIVE_ROOT_MOVE: "The root folder cannot be moved.",
  DRIVE_ACCESS_DENIED: "You do not have permission to move this item.",
  DOWNLOAD_FOLDER: "Folders cannot be downloaded.",
};

/**
 * Extracts a user-facing error message from an API error.
 */
export function getErrorMessage(error) {
  if (error?.data?.code && ERROR_MESSAGES[error.data.code]) {
    return ERROR_MESSAGES[error.data.code];
  }
  return error?.message || "An unexpected error occurred.";
}

/**
 * Returns the error code from an API error, if present.
 */
export function getErrorCode(error) {
  return error?.data?.code || null;
}

/** GET /users/{userId}/drives/{driveKey} */
export async function listDriveContents(userId, driveKey) {
  return apiClient.get(`/users/${userId}/drives/${driveKey}`);
}

/** POST /users/{userId}/drives/{driveKey}/folders */
export async function createFolder(userId, driveKey, name, parentId) {
  return apiClient.post(`/users/${userId}/drives/${driveKey}/folders`, {
    name,
    parentId,
  });
}

/** PUT /users/{userId}/drives/{driveKey}/items/{itemId} */
export async function updateItem(userId, driveKey, itemId, updates) {
  return apiClient.put(
    `/users/${userId}/drives/${driveKey}/items/${itemId}`,
    updates,
  );
}

/** PUT /users/{userId}/drives/{driveKey}/items/{itemId}/move */
export async function moveItem(userId, driveKey, itemId, parentId) {
  return apiClient.put(
    `/users/${userId}/drives/${driveKey}/items/${itemId}/move`,
    { parentId },
  );
}

/** DELETE /users/{userId}/drives/{driveKey}/items/{itemId} */
export async function deleteItem(userId, driveKey, itemId) {
  return apiClient.del(`/users/${userId}/drives/${driveKey}/items/${itemId}`);
}

/**
 * Thrown by downloadFile() when a size-capped download (previews) exceeds maxBytes.
 * The transfer is aborted as soon as the limit is crossed.
 */
export class PreviewTooLargeError extends Error {
  constructor(maxBytes, bytes = null) {
    super("This file is too large to preview.");
    this.name = "PreviewTooLargeError";
    this.maxBytes = maxBytes;
    this.bytes = bytes;
  }
}

/**
 * Reads a response body into a Blob, aborting once more than maxBytes arrive.
 * Falls back to response.blob() (then checks the size) when streams are unavailable.
 */
async function readCappedBlob(response, maxBytes, abort) {
  const type = response.headers.get("content-type") || "";

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    abort();
    throw new PreviewTooLargeError(maxBytes, declared);
  }

  if (!response.body || typeof response.body.getReader !== "function") {
    const blob = await response.blob();
    if (blob.size > maxBytes) throw new PreviewTooLargeError(maxBytes, blob.size);
    return blob;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      reader.cancel().catch(() => {});
      abort();
      throw new PreviewTooLargeError(maxBytes, received);
    }
    chunks.push(value);
  }
  return new Blob(chunks, type ? { type } : undefined);
}

/**
 * GET /users/{userId}/drives/{driveKey}/items/{itemId}/download — returns Blob
 * @param {string} userId
 * @param {string} driveKey
 * @param {string} itemId
 * @param {{signal?: AbortSignal, maxBytes?: number}} [options]
 *   maxBytes: stream the body and abort with PreviewTooLargeError past this size
 * @returns {Promise<Blob>}
 */
export async function downloadFile(
  userId,
  driveKey,
  itemId,
  { signal, maxBytes } = {},
) {
  const url = `${API_BASE_URL}/users/${userId}/drives/${driveKey}/items/${itemId}/download`;
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Own controller so an oversized preview can be cut off; follows the caller's signal
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) {
        apiClient.handleUnauthorized();
        throw new apiClient.AuthenticationError("Session expired");
      }
      let errorData = null;
      try {
        errorData = await response.json();
      } catch {
        /* not JSON */
      }
      throw new apiClient.ApiError(
        errorData?.message || "Download failed",
        response.status,
        errorData,
      );
    }

    const cap = Number(maxBytes);
    if (maxBytes === undefined || maxBytes === null || !Number.isFinite(cap)) {
      return await response.blob();
    }
    return await readCappedBlob(response, Math.max(0, cap), () => controller.abort());
  } finally {
    if (signal) signal.removeEventListener("abort", forwardAbort);
  }
}

/**
 * Internal helper: performs a multipart/form-data POST via XMLHttpRequest with progress tracking.
 */
function xhrUpload(url, formData, onProgress, errorLabel) {
  const token = getToken();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(null);
        }
      } else {
        if (xhr.status === 401) {
          apiClient.handleUnauthorized();
          reject(new apiClient.AuthenticationError("Session expired"));
          return;
        }
        let errorData = null;
        try {
          errorData = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        reject(
          new apiClient.ApiError(
            errorData?.message || `${errorLabel} failed`,
            xhr.status,
            errorData,
          ),
        );
      }
    };

    xhr.onerror = () =>
      reject(new apiClient.ApiError(`${errorLabel} failed`, 0, null));
    xhr.send(formData);
  });
}

/** POST /users/{userId}/drives/{driveKey}/files — multipart/form-data */
export function uploadFile(userId, driveKey, file, parentId, onProgress) {
  const url = `${API_BASE_URL}/users/${userId}/drives/${driveKey}/files`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("parentId", parentId);
  return xhrUpload(url, formData, onProgress, "Upload");
}

/** POST /users/{userId}/plex/upload — multipart/form-data */
export function plexUpload(userId, file, onProgress) {
  const url = `${API_BASE_URL}/users/${userId}/plex/upload`;
  const formData = new FormData();
  formData.append("file", file);
  return xhrUpload(url, formData, onProgress, "Plex upload");
}

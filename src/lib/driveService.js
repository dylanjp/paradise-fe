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
  DRIVE_ITEM_CONFLICT: "A folder with that name already exists.",
  DRIVE_ROOT_DELETION: "The root folder cannot be deleted.",
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

/** DELETE /users/{userId}/drives/{driveKey}/items/{itemId} */
export async function deleteItem(userId, driveKey, itemId) {
  return apiClient.del(`/users/${userId}/drives/${driveKey}/items/${itemId}`);
}

/** GET /users/{userId}/drives/{driveKey}/items/{itemId}/download — returns Blob */
export async function downloadFile(userId, driveKey, itemId) {
  const url = `${API_BASE_URL}/users/${userId}/drives/${driveKey}/items/${itemId}/download`;
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
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
  return response.blob();
}

/** POST /users/{userId}/drives/{driveKey}/files — multipart/form-data */
export function uploadFile(userId, driveKey, file, parentId, onProgress) {
  const url = `${API_BASE_URL}/users/${userId}/drives/${driveKey}/files`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("parentId", parentId);
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
        let errorData = null;
        try {
          errorData = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        reject(
          new apiClient.ApiError(
            errorData?.message || "Upload failed",
            xhr.status,
            errorData,
          ),
        );
      }
    };

    xhr.onerror = () =>
      reject(new apiClient.ApiError("Upload failed", 0, null));
    xhr.send(formData);
  });
}

/** POST /users/{userId}/plex/upload — multipart/form-data */
export function plexUpload(userId, file, onProgress) {
  const url = `${API_BASE_URL}/users/${userId}/plex/upload`;
  const formData = new FormData();
  formData.append("file", file);
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
        let errorData = null;
        try {
          errorData = JSON.parse(xhr.responseText);
        } catch {
          /* not JSON */
        }
        reject(
          new apiClient.ApiError(
            errorData?.message || "Plex upload failed",
            xhr.status,
            errorData,
          ),
        );
      }
    };

    xhr.onerror = () =>
      reject(new apiClient.ApiError("Plex upload failed", 0, null));
    xhr.send(formData);
  });
}

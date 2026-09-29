/**
 * HSA Receipt Service
 * Orchestrates the multi-step "file a receipt" flow on top of the MyDrive API:
 * resolve (or create) the "HSA Receipts" folder in the Admin Drive, rename the
 * file to the canonical `{amount}_{YYYY}_{MON}_{DD}.{ext}` form, then upload it.
 *
 * driveService.js stays a thin one-function-per-endpoint transport layer; all
 * sequencing, folder provisioning, and collision handling lives here.
 */

import * as driveService from "./driveService";
import {
  buildReceiptNameParts,
  joinNameParts,
  nextAvailableFileName,
} from "../../utils/hsaReceipt";

export const HSA_DRIVE_KEY = "adminDrive";
export const HSA_FOLDER_NAME = "HSA Receipts";

const ROOT_ID = "root";
const MAX_COLLISION_RETRIES = 5;

/** True when the API rejected the write because the name is already taken. */
function isConflict(error) {
  return (
    error?.status === 409 ||
    driveService.getErrorCode(error) === "DRIVE_ITEM_CONFLICT"
  );
}

/**
 * True when the API rejected the request for lack of permission.
 * Detected by status rather than by error code: apiClient throws
 * AuthorizationError without reading the response body, so getErrorCode()
 * returns null on the list and createFolder paths.
 *
 * @param {Error} error
 * @returns {boolean}
 */
export function isPermissionDenied(error) {
  return error?.status === 403;
}

/**
 * Finds the "HSA Receipts" folder directly under the Admin Drive root.
 *
 * @param {Record<string, object>} contents - Flat map from listDriveContents
 * @returns {object|null}
 */
export function findReceiptsFolder(contents) {
  if (!contents) return null;

  const root = contents[ROOT_ID];
  if (root && Array.isArray(root.children)) {
    for (const childId of root.children) {
      const item = contents[childId];
      if (item && item.type === "folder" && item.name === HSA_FOLDER_NAME) {
        return item;
      }
    }
    return null;
  }

  // Defensive fallback for a listing whose root entry is missing.
  return (
    Object.values(contents).find(
      (item) =>
        item &&
        item.type === "folder" &&
        item.name === HSA_FOLDER_NAME &&
        item.parentId === ROOT_ID,
    ) || null
  );
}

/**
 * Ensures the "HSA Receipts" folder exists, returning it alongside the drive
 * listing it was resolved from — the caller reuses that listing to pick a
 * collision-free file name without a second round trip.
 *
 * @param {string} userId - Username from useAuth()
 * @returns {Promise<{ folder: object, contents: Record<string, object> }>}
 */
export async function ensureReceiptsFolder(userId) {
  let contents = await driveService.listDriveContents(userId, HSA_DRIVE_KEY);
  let folder = findReceiptsFolder(contents);
  if (folder) return { folder, contents };

  try {
    folder = await driveService.createFolder(
      userId,
      HSA_DRIVE_KEY,
      HSA_FOLDER_NAME,
      ROOT_ID,
    );
    // The listing predates the folder, so it legitimately has no children yet.
    return { folder, contents };
  } catch (error) {
    if (!isConflict(error)) throw error;
    // Another tab created it between our list and our create — re-read and reuse.
    contents = await driveService.listDriveContents(userId, HSA_DRIVE_KEY);
    folder = findReceiptsFolder(contents);
    if (!folder) throw error;
    return { folder, contents };
  }
}

/**
 * Direct child names of a folder within a drive listing.
 *
 * @param {Record<string, object>} contents
 * @param {string} folderId
 * @returns {string[]}
 */
export function listFolderChildNames(contents, folderId) {
  const folder = contents?.[folderId];
  if (!folder || !Array.isArray(folder.children)) return [];
  return folder.children.map((id) => contents[id]?.name).filter(Boolean);
}

/**
 * Copies a File under a new name. The backend stores
 * MultipartFile.getOriginalFilename() verbatim, so the rename must happen here.
 *
 * @param {File} file
 * @param {string} newName
 * @returns {File}
 */
export function renameFile(file, newName) {
  return new File([file], newName, {
    type: file.type,
    lastModified: file.lastModified,
  });
}

/**
 * Uploads an HSA receipt into "HSA Receipts" in the Admin Drive.
 *
 * Collision-free naming is picked locally from the folder listing we already
 * hold; the 409 retry below is only a backstop for a concurrent upload that
 * claimed the name after we listed.
 *
 * @param {string} userId - Username from useAuth()
 * @param {File} file - The user-selected file
 * @param {number} amount - Validated whole-dollar amount (see parseAmount)
 * @param {object} [options]
 * @param {(pct: number) => void} [options.onProgress] - 0-100 upload progress
 * @param {string} options.isoDate - Validated ISO receipt date (YYYY-MM-DD)
 * @returns {Promise<{ item: object, fileName: string }>}
 */
export async function uploadReceipt(userId, file, amount, options = {}) {
  const { onProgress, isoDate } = options;

  const { folder, contents } = await ensureReceiptsFolder(userId);
  const parts = buildReceiptNameParts(amount, file.name, isoDate);
  const knownNames = listFolderChildNames(contents, folder.id);

  let candidate = nextAvailableFileName(parts, knownNames);

  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    try {
      const item = await driveService.uploadFile(
        userId,
        HSA_DRIVE_KEY,
        renameFile(file, candidate),
        folder.id,
        onProgress,
      );
      return { item, fileName: candidate };
    } catch (error) {
      if (!isConflict(error)) throw error;
      // Lost a race, or the listing was stale — step past every name now known taken.
      knownNames.push(candidate);
      candidate = nextAvailableFileName(parts, knownNames);
    }
  }

  throw new Error(
    `A receipt named "${joinNameParts(parts)}" already exists and no free variant could be reserved.`,
  );
}

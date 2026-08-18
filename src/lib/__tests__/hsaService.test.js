/**
 * Tests for the HSA receipt upload orchestration.
 *
 * driveService is mocked, so these cover the sequencing that the pure naming
 * helpers cannot: folder provisioning, the create/upload conflict races, and
 * the client-side rename that gives the stored file its name.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../driveService", () => ({
  listDriveContents: vi.fn(),
  createFolder: vi.fn(),
  uploadFile: vi.fn(),
  getErrorCode: vi.fn(() => null),
}));

import * as driveService from "../driveService";
import {
  HSA_DRIVE_KEY,
  HSA_FOLDER_NAME,
  findReceiptsFolder,
  ensureReceiptsFolder,
  listFolderChildNames,
  renameFile,
  uploadReceipt,
  isPermissionDenied,
} from "../hsaService";

const USER = "dylan";
const ISO_DATE = "2026-08-16";
const EXPECTED_NAME = "1000_2026_AUG_16.pdf";

/** A drive listing containing the HSA folder with the given child items. */
function listingWithFolder(children = {}) {
  const childIds = Object.keys(children);
  return {
    root: { id: "root", name: "Admin Drive", type: "folder", children: ["f1"] },
    f1: {
      id: "f1",
      name: HSA_FOLDER_NAME,
      type: "folder",
      parentId: "root",
      children: childIds,
    },
    ...children,
  };
}

function makeFile(name = "scan.pdf", content = "receipt bytes") {
  return new File([content], name, { type: "application/pdf" });
}

function conflictError() {
  const err = new Error("An item with that name already exists");
  err.status = 409;
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  driveService.getErrorCode.mockReturnValue(null);
});

describe("findReceiptsFolder", () => {
  it("finds the folder among the root's children", () => {
    expect(findReceiptsFolder(listingWithFolder()).id).toBe("f1");
  });

  it("returns null when the folder is absent", () => {
    const contents = {
      root: { id: "root", type: "folder", children: ["a"] },
      a: {
        id: "a",
        name: "Other",
        type: "folder",
        parentId: "root",
        children: [],
      },
    };
    expect(findReceiptsFolder(contents)).toBeNull();
  });

  it("ignores a file that merely shares the folder's name", () => {
    const contents = {
      root: { id: "root", type: "folder", children: ["a"] },
      a: { id: "a", name: HSA_FOLDER_NAME, type: "file", parentId: "root" },
    };
    expect(findReceiptsFolder(contents)).toBeNull();
  });

  it("ignores a same-named folder nested deeper in the tree", () => {
    const contents = {
      root: { id: "root", type: "folder", children: ["a"] },
      a: {
        id: "a",
        name: "Archive",
        type: "folder",
        parentId: "root",
        children: ["b"],
      },
      b: {
        id: "b",
        name: HSA_FOLDER_NAME,
        type: "folder",
        parentId: "a",
        children: [],
      },
    };
    expect(findReceiptsFolder(contents)).toBeNull();
  });

  it("falls back to a parentId scan when the root entry is missing", () => {
    const contents = {
      b: {
        id: "b",
        name: HSA_FOLDER_NAME,
        type: "folder",
        parentId: "root",
        children: [],
      },
    };
    expect(findReceiptsFolder(contents).id).toBe("b");
  });

  it("tolerates a null listing", () => {
    expect(findReceiptsFolder(null)).toBeNull();
  });
});

describe("listFolderChildNames", () => {
  it("returns the direct child names", () => {
    const contents = listingWithFolder({
      c1: { id: "c1", name: EXPECTED_NAME, type: "file", parentId: "f1" },
    });
    expect(listFolderChildNames(contents, "f1")).toEqual([EXPECTED_NAME]);
  });

  it("returns an empty array for an unknown or childless folder", () => {
    expect(listFolderChildNames(listingWithFolder(), "nope")).toEqual([]);
    expect(listFolderChildNames(undefined, "f1")).toEqual([]);
  });
});

describe("ensureReceiptsFolder", () => {
  it("reuses an existing folder without creating one", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());

    const { folder } = await ensureReceiptsFolder(USER);

    expect(folder.id).toBe("f1");
    expect(driveService.createFolder).not.toHaveBeenCalled();
  });

  it("creates the folder at the drive root when absent", async () => {
    driveService.listDriveContents.mockResolvedValue({
      root: { id: "root", type: "folder", children: [] },
    });
    driveService.createFolder.mockResolvedValue({
      id: "new",
      name: HSA_FOLDER_NAME,
      type: "folder",
      parentId: "root",
      children: [],
    });

    const { folder } = await ensureReceiptsFolder(USER);

    expect(driveService.createFolder).toHaveBeenCalledWith(
      USER,
      HSA_DRIVE_KEY,
      HSA_FOLDER_NAME,
      "root",
    );
    expect(folder.id).toBe("new");
  });

  it("re-lists and reuses the folder when creation loses a race", async () => {
    driveService.listDriveContents
      .mockResolvedValueOnce({
        root: { id: "root", type: "folder", children: [] },
      })
      .mockResolvedValueOnce(listingWithFolder());
    driveService.createFolder.mockRejectedValue(conflictError());

    const { folder } = await ensureReceiptsFolder(USER);

    expect(folder.id).toBe("f1");
    expect(driveService.listDriveContents).toHaveBeenCalledTimes(2);
  });

  it("rethrows the conflict if the folder still cannot be found", async () => {
    driveService.listDriveContents.mockResolvedValue({
      root: { id: "root", type: "folder", children: [] },
    });
    driveService.createFolder.mockRejectedValue(conflictError());

    await expect(ensureReceiptsFolder(USER)).rejects.toThrow(/already exists/);
  });

  it("rethrows non-conflict errors untouched", async () => {
    driveService.listDriveContents.mockResolvedValue({
      root: { id: "root", type: "folder", children: [] },
    });
    const denied = new Error("Access denied");
    denied.status = 403;
    driveService.createFolder.mockRejectedValue(denied);

    await expect(ensureReceiptsFolder(USER)).rejects.toBe(denied);
  });
});

/** jsdom's File has no .text(), so read it the long way. */
function readAsText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe("renameFile", () => {
  it("changes only the name, preserving type and contents", async () => {
    const original = makeFile("scan.pdf", "abc");
    const renamed = renameFile(original, EXPECTED_NAME);

    expect(renamed.name).toBe(EXPECTED_NAME);
    expect(renamed.type).toBe("application/pdf");
    expect(renamed.size).toBe(original.size);
    expect(await readAsText(renamed)).toBe("abc");
  });
});

describe("uploadReceipt", () => {
  beforeEach(() => {
    driveService.uploadFile.mockResolvedValue({ id: "uploaded" });
  });

  it("uploads under the generated name into the receipts folder", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());

    const result = await uploadReceipt(USER, makeFile(), 1000, {
      isoDate: ISO_DATE,
    });

    expect(result.fileName).toBe(EXPECTED_NAME);
    const [userId, driveKey, sentFile, parentId] =
      driveService.uploadFile.mock.calls[0];
    expect(userId).toBe(USER);
    expect(driveKey).toBe(HSA_DRIVE_KEY);
    expect(sentFile.name).toBe(EXPECTED_NAME);
    expect(parentId).toBe("f1");
  });

  it("picks the _2 variant when the listing already holds the base name", async () => {
    driveService.listDriveContents.mockResolvedValue(
      listingWithFolder({
        c1: { id: "c1", name: EXPECTED_NAME, type: "file", parentId: "f1" },
      }),
    );

    const result = await uploadReceipt(USER, makeFile(), 1000, {
      isoDate: ISO_DATE,
    });

    expect(result.fileName).toBe("1000_2026_AUG_16_2.pdf");
  });

  it("retries past a conflict raised after the listing was read", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());
    driveService.uploadFile
      .mockRejectedValueOnce(conflictError())
      .mockResolvedValueOnce({ id: "uploaded" });

    const result = await uploadReceipt(USER, makeFile(), 1000, {
      isoDate: ISO_DATE,
    });

    expect(result.fileName).toBe("1000_2026_AUG_16_2.pdf");
    expect(driveService.uploadFile).toHaveBeenCalledTimes(2);
  });

  it("gives up with a readable message after repeated conflicts", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());
    driveService.uploadFile.mockRejectedValue(conflictError());

    await expect(
      uploadReceipt(USER, makeFile(), 1000, { isoDate: ISO_DATE }),
    ).rejects.toThrow(/no free variant could be reserved/);
  });

  it("propagates a permission error so the modal can special-case it", async () => {
    const denied = new Error("Access denied");
    denied.status = 403;
    driveService.listDriveContents.mockRejectedValue(denied);

    await expect(
      uploadReceipt(USER, makeFile(), 1000, { isoDate: ISO_DATE }),
    ).rejects.toBe(denied);
    expect(isPermissionDenied(denied)).toBe(true);
  });

  it("forwards the progress callback to the upload transport", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());
    const onProgress = vi.fn();

    await uploadReceipt(USER, makeFile(), 1000, {
      isoDate: ISO_DATE,
      onProgress,
    });

    expect(driveService.uploadFile.mock.calls[0][4]).toBe(onProgress);
  });

  it("recognises a conflict signalled only by error code", async () => {
    driveService.listDriveContents.mockResolvedValue(listingWithFolder());
    const coded = new Error("conflict");
    driveService.getErrorCode.mockReturnValue("DRIVE_ITEM_CONFLICT");
    driveService.uploadFile
      .mockRejectedValueOnce(coded)
      .mockResolvedValueOnce({ id: "uploaded" });

    const result = await uploadReceipt(USER, makeFile(), 1000, {
      isoDate: ISO_DATE,
    });

    expect(result.fileName).toBe("1000_2026_AUG_16_2.pdf");
  });
});

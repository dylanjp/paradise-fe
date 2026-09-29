/**
 * Tests for the Drive icon lookup: previewable types get their own icons, and
 * unusual extensions (including Object.prototype names) fall back safely.
 */

import { describe, it, expect } from "vitest";
import { getIconForType, getFileExtension } from "../driveUtils";

describe("getIconForType", () => {
  it("maps the previewable extensions to specific icons", () => {
    const fallback = getIconForType("file", "zip");
    // prettier-ignore
    const previewable = [
      "webp", "svg", "bmp", "avif", "txt", "md", "csv", "json", "canvas",
      "webm", "mov", "m4v", "m4a", "flac", "aac", "pdf", "png", "mp4",
    ];
    for (const ext of previewable) {
      const entry = getIconForType("file", ext);
      expect(entry).not.toBe(fallback);
      expect(typeof entry.icon).toBe("function");
      expect(entry.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(getIconForType("file", "PDF")).toBe(getIconForType("file", "pdf"));
  });

  it("falls back for unknown, missing and prototype-named types", () => {
    const fallback = getIconForType("file", "zip");
    for (const ext of [
      "constructor",
      "__proto__",
      "toString",
      "hasOwnProperty",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(getIconForType("file", ext)).toBe(fallback);
    }
  });

  it("uses the folder icon for folders", () => {
    expect(getIconForType("folder", "pdf").color).toBe("#4a9eff");
  });
});

describe("getFileExtension", () => {
  it("returns the lower-cased extension", () => {
    expect(getFileExtension("Report.PDF")).toBe("pdf");
    expect(getFileExtension("README")).toBe("");
    expect(getFileExtension("trailing.")).toBe("");
    expect(getFileExtension(null)).toBe("");
  });
});

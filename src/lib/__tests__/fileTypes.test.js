/**
 * Tests for the file type helpers shared by Docs and Drive previews:
 * kind detection, safe MIME types, size parsing, preview limits and the
 * Blob URL helpers (which must never expose a same-origin SVG/HTML blob).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import {
  getExtension,
  getFileKind,
  getMimeType,
  getPlaybackMimeCandidates,
  parseSizeString,
  getPreviewLimit,
  canPreview,
  allowsOpenInNewTab,
  retypeBlob,
  blobToDisplayUrl,
  saveBlobAs,
  openBlobInNewTab,
} from "../fileTypes";

const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** JS port of the backend's ByteSizes.format (with a selectable decimal separator) */
function formatBytes(bytes, decimal = ".") {
  const unit = (value, suffix) =>
    value === Math.floor(value)
      ? `${value} ${suffix}`
      : `${value.toFixed(1).replace(".", decimal)} ${suffix}`;
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return unit(bytes / KB, "KB");
  if (bytes < GB) return unit(bytes / MB, "MB");
  return unit(bytes / GB, "GB");
}

const ALL_KNOWN_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
  "ico",
  "pdf",
  "md",
  "markdown",
  "canvas",
  "txt",
  "log",
  "csv",
  "tsv",
  "json",
  "xml",
  "yaml",
  "yml",
  "ini",
  "conf",
  "toml",
  "properties",
  "env",
  "js",
  "jsx",
  "ts",
  "tsx",
  "java",
  "py",
  "css",
  "scss",
  "html",
  "sh",
  "bat",
  "ps1",
  "sql",
  "go",
  "rs",
  "c",
  "cpp",
  "h",
  "cs",
  "rb",
  "php",
  "kt",
  "gradle",
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "flac",
  "aac",
  "mp4",
  "webm",
  "mov",
  "m4v",
];

describe("getExtension", () => {
  it("returns the lower-cased extension of the last path segment", () => {
    expect(getExtension("Photo.PNG")).toBe("png");
    expect(getExtension("LE Docs/Amira/Amira Board.canvas")).toBe("canvas");
    expect(getExtension("folder.v2/README")).toBe("");
    expect(getExtension("C:\\docs.d\\notes")).toBe("");
    expect(getExtension(".env")).toBe("env");
    expect(getExtension("trailing.")).toBe("");
    expect(getExtension("")).toBe("");
    expect(getExtension(null)).toBe("");
  });
});

describe("getFileKind", () => {
  it("maps names and bare extensions to kinds", () => {
    expect(getFileKind("a.png")).toBe("image");
    expect(getFileKind("SVG")).toBe("image");
    expect(getFileKind("report.PDF")).toBe("pdf");
    expect(getFileKind("notes.md")).toBe("markdown");
    expect(getFileKind("markdown")).toBe("markdown");
    expect(getFileKind("Board.canvas")).toBe("canvas");
    expect(getFileKind("index.html")).toBe("text");
    expect(getFileKind("build.gradle")).toBe("text");
    expect(getFileKind("song.flac")).toBe("audio");
    expect(getFileKind("clip.MOV")).toBe("video");
    expect(getFileKind(".pdf")).toBe("pdf");
  });

  it("returns null for unknown or missing extensions", () => {
    expect(getFileKind("archive.zip")).toBeNull();
    expect(getFileKind("README")).toBeNull();
    expect(getFileKind("")).toBeNull();
    expect(getFileKind(undefined)).toBeNull();
    expect(getFileKind("constructor")).toBeNull();
    expect(getFileKind("x.__proto__")).toBeNull();
  });
});

describe("getMimeType", () => {
  it("wraps text, markdown and canvas kinds as text/plain", () => {
    for (const ext of [
      "md",
      "canvas",
      "txt",
      "json",
      "html",
      "xml",
      "js",
      "csv",
    ]) {
      expect(getMimeType(ext)).toBe("text/plain;charset=utf-8");
    }
  });

  it("returns real types for binary previews", () => {
    expect(getMimeType("pdf")).toBe("application/pdf");
    expect(getMimeType("jpg")).toBe("image/jpeg");
    expect(getMimeType("PNG")).toBe("image/png");
    expect(getMimeType("mp3")).toBe("audio/mpeg");
    expect(getMimeType("mp4")).toBe("video/mp4");
    expect(getMimeType("mov")).toBe("video/quicktime");
  });

  it("never exposes svg and falls back to octet-stream", () => {
    expect(getMimeType("svg")).toBe("application/octet-stream");
    expect(getMimeType("zip")).toBe("application/octet-stream");
    expect(getMimeType("")).toBe("application/octet-stream");
  });

  it("never returns an html, svg or xml type for any extension (property)", () => {
    for (const ext of ALL_KNOWN_EXTENSIONS) {
      expect(getMimeType(ext)).not.toMatch(/html|svg|xml/i);
    }
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (ext) => {
        expect(getMimeType(ext)).not.toMatch(/html|svg|xml/i);
      }),
    );
  });

  it("lists canPlayType candidates, trying mp4 first for mov/m4v", () => {
    expect(getPlaybackMimeCandidates("mov")).toEqual([
      "video/mp4",
      "video/quicktime",
    ]);
    expect(getPlaybackMimeCandidates("m4v")[0]).toBe("video/mp4");
    expect(getPlaybackMimeCandidates("mp3")).toEqual(["audio/mpeg"]);
    expect(getPlaybackMimeCandidates("pdf")).toEqual([]);
  });
});

describe("parseSizeString", () => {
  it("parses ByteSizes.format output in binary units", () => {
    expect(parseSizeString("512 B")).toBe(512);
    expect(parseSizeString("1 KB")).toBe(1024);
    expect(parseSizeString("2.4 MB")).toBe(Math.round(2.4 * MB));
    expect(parseSizeString("3 GB")).toBe(3 * GB);
    expect(parseSizeString("1 GB")).toBe(GB);
    expect(parseSizeString("0 B")).toBe(0);
    expect(parseSizeString("1023 B")).toBe(1023);
    expect(parseSizeString("  10 mb ")).toBe(10 * MB);
  });

  it("accepts comma decimals from non-English locales", () => {
    expect(parseSizeString("1,5 GB")).toBe(Math.round(1.5 * GB));
    expect(parseSizeString("0,5 KB")).toBe(512);
  });

  it("returns null for garbage", () => {
    // prettier-ignore
    const garbage = [
      "", "12", "MB", "-1 MB", "1.2.3 MB", "1 XB", "abc", "1e9 B", "1,5,0 GB", "1. MB",
      ",5 MB", "NaN MB", "Infinity GB", "0x10 KB", "1 GB extra", null, undefined, 42, {},
    ];
    for (const bad of garbage) {
      expect(parseSizeString(bad)).toBeNull();
    }
  });

  it("round-trips the backend format within rounding error (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 * 1024 * GB }),
        fc.constantFrom(".", ","),
        (bytes, decimal) => {
          const parsed = parseSizeString(formatBytes(bytes, decimal));
          expect(parsed).not.toBeNull();
          expect(Math.abs(parsed - bytes)).toBeLessThanOrEqual(
            bytes * 0.05 + 1,
          );
        },
      ),
    );
  });
});

describe("preview limits", () => {
  let originalMatchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("uses the per-kind limits", () => {
    window.matchMedia = () => ({ matches: false });
    expect(getPreviewLimit("image")).toBe(50 * MB);
    expect(getPreviewLimit("pdf")).toBe(100 * MB);
    expect(getPreviewLimit("text")).toBe(5 * MB);
    expect(getPreviewLimit("markdown")).toBe(5 * MB);
    expect(getPreviewLimit("audio")).toBe(250 * MB);
    expect(getPreviewLimit("video")).toBe(250 * MB);
    expect(getPreviewLimit(null)).toBe(0);
    expect(getPreviewLimit("toString")).toBe(0);
  });

  it("lowers audio/video limits on coarse pointers", () => {
    window.matchMedia = (q) => ({ matches: q === "(pointer: coarse)" });
    expect(getPreviewLimit("video")).toBe(100 * MB);
    expect(getPreviewLimit("audio")).toBe(100 * MB);
    expect(getPreviewLimit("image")).toBe(50 * MB);
  });

  it("canPreview checks kind and size, allowing unknown sizes", () => {
    window.matchMedia = () => ({ matches: false });
    expect(canPreview("image", 50 * MB)).toBe(true);
    expect(canPreview("image", 50 * MB + 1)).toBe(false);
    expect(canPreview("pdf", 99 * MB)).toBe(true);
    expect(canPreview("text", 6 * MB)).toBe(false);
    expect(canPreview("video", null)).toBe(true);
    expect(canPreview("video", undefined)).toBe(true);
    expect(canPreview(null, 10)).toBe(false);
    expect(canPreview("image", -1)).toBe(false);
    expect(canPreview("image", NaN)).toBe(false);
  });
});

describe("allowsOpenInNewTab", () => {
  it("allows only pdf, raster images, audio and video", () => {
    expect(allowsOpenInNewTab("pdf", "pdf")).toBe(true);
    expect(allowsOpenInNewTab("image", "png")).toBe(true);
    expect(allowsOpenInNewTab("image", "photo.JPG")).toBe(true);
    expect(allowsOpenInNewTab("audio", "mp3")).toBe(true);
    expect(allowsOpenInNewTab("video", "mp4")).toBe(true);
  });

  it("never allows svg, text-like kinds or mismatched pairs", () => {
    expect(allowsOpenInNewTab("image", "svg")).toBe(false);
    expect(allowsOpenInNewTab("image", "evil.svg")).toBe(false);
    expect(allowsOpenInNewTab("markdown", "md")).toBe(false);
    expect(allowsOpenInNewTab("text", "html")).toBe(false);
    expect(allowsOpenInNewTab("canvas", "canvas")).toBe(false);
    expect(allowsOpenInNewTab("pdf", "html")).toBe(false);
    expect(allowsOpenInNewTab("image", "html")).toBe(false);
    expect(allowsOpenInNewTab(null, "png")).toBe(false);
  });
});

describe("retypeBlob", () => {
  it("retypes to the safe MIME type", () => {
    const html = new Blob(["<script>alert(1)</script>"], { type: "text/html" });
    expect(retypeBlob(html, "html").type).toBe("text/plain;charset=utf-8");
    expect(retypeBlob(html, "md").type).toBe("text/plain;charset=utf-8");
    expect(retypeBlob(html, "canvas").type).toBe("text/plain;charset=utf-8");
    expect(retypeBlob(html, "svg").type).toBe("application/octet-stream");
    expect(retypeBlob(html, "png").type).toBe("image/png");
    expect(retypeBlob(html, "png").size).toBe(html.size);
  });
});

describe("Blob URL helpers", () => {
  let created;
  let revoked;
  let clicks;
  let originalCreate;
  let originalRevoke;

  beforeEach(() => {
    created = [];
    revoked = [];
    clicks = [];
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      const url = `blob:mock/${created.length + 1}`;
      created.push({ url, blob });
      return url;
    });
    URL.revokeObjectURL = vi.fn((url) => revoked.push(url));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function () {
        clicks.push({
          href: this.getAttribute("href"),
          download: this.getAttribute("download"),
          target: this.getAttribute("target"),
          rel: this.getAttribute("rel"),
          attached: document.body.contains(this),
        });
      },
    );
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("blobToDisplayUrl turns SVG into a data: URL without an object URL", async () => {
    const svg = new Blob([
      "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
    ]);
    const { url, revoke } = await blobToDisplayUrl(svg, "svg");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(() => revoke()).not.toThrow();
  });

  it("blobToDisplayUrl uses a retyped object URL for everything else", async () => {
    const png = new Blob(["png-bytes"], { type: "text/html" });
    const { url, revoke } = await blobToDisplayUrl(png, "png");
    expect(url).toBe("blob:mock/1");
    expect(created[0].blob.type).toBe("image/png");
    revoke();
    revoke();
    expect(revoked).toEqual(["blob:mock/1"]);
  });

  it("saveBlobAs downloads an octet-stream copy and revokes after 60s", () => {
    vi.useFakeTimers();
    const blob = new Blob(["hello"], { type: "text/html" });
    saveBlobAs(blob, "notes.html");

    expect(created).toHaveLength(1);
    expect(created[0].blob.type).toBe("application/octet-stream");
    expect(clicks).toEqual([
      expect.objectContaining({
        href: "blob:mock/1",
        download: "notes.html",
        attached: true,
      }),
    ]);
    expect(document.querySelector('a[download="notes.html"]')).toBeNull();

    vi.advanceTimersByTime(59_000);
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(revoked).toEqual(["blob:mock/1"]);
  });

  it("openBlobInNewTab opens allowed kinds with noopener and revokes after 60s", () => {
    vi.useFakeTimers();
    openBlobInNewTab(new Blob(["%PDF-"]), "pdf");
    expect(created[0].blob.type).toBe("application/pdf");
    expect(clicks[0]).toEqual(
      expect.objectContaining({ target: "_blank", rel: "noopener noreferrer" }),
    );
    vi.advanceTimersByTime(60_000);
    expect(revoked).toEqual(["blob:mock/1"]);
  });

  it("openBlobInNewTab opens audio/video with the playback MIME it was given", () => {
    const mov = new Blob(["mov-bytes"]);
    openBlobInNewTab(mov, "mov", { type: "video/mp4" });
    openBlobInNewTab(mov, "mov");
    openBlobInNewTab(new Blob(["m4a"]), "m4a", { type: "audio/mp4" });
    expect(created.map((c) => c.blob.type)).toEqual([
      "video/mp4",
      "video/quicktime",
      "audio/mp4",
    ]);
    expect(created[0].blob.size).toBe(mov.size);
    expect(clicks).toHaveLength(3);
  });

  it("openBlobInNewTab ignores a MIME override that isn't a playback type for the file", () => {
    openBlobInNewTab(new Blob(["x"]), "mov", { type: "text/html" });
    openBlobInNewTab(new Blob(["x"]), "mp4", { type: "video/quicktime" });
    openBlobInNewTab(new Blob(["x"]), "png", { type: "image/svg+xml" });
    openBlobInNewTab(new Blob(["x"]), "pdf", { type: "video/mp4" });
    openBlobInNewTab(new Blob(["x"]), "mov", null);
    expect(created.map((c) => c.blob.type)).toEqual([
      "video/quicktime",
      "video/mp4",
      "image/png",
      "application/pdf",
      "video/quicktime",
    ]);
  });

  it("openBlobInNewTab is a no-op for svg, markdown and html", () => {
    openBlobInNewTab(new Blob(["<svg/>"]), "svg");
    openBlobInNewTab(new Blob(["# hi"]), "md");
    openBlobInNewTab(new Blob(["<b>"]), "html");
    openBlobInNewTab(null, "pdf");
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(clicks).toEqual([]);
  });
});

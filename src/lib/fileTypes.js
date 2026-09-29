/**
 * File Types Module
 * Maps file names/extensions to preview kinds, safe MIME types and preview size limits,
 * plus the Blob helpers shared by the Documentation page and Drive previews.
 *
 * Security notes:
 * - Blobs handed to URL.createObjectURL are same-origin with the app, so anything the
 *   user could navigate to (open in new tab, right-click "open image") must never be
 *   typed as HTML, SVG or XML. getMimeType() therefore never returns those types.
 * - SVG is only ever displayed through a data: URL (opaque origin), see blobToDisplayUrl().
 */

/** Extensions per preview kind (lower-case, no dot) */
// prettier-ignore
const KIND_EXTENSIONS = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico"],
  pdf: ["pdf"],
  markdown: ["md", "markdown"],
  canvas: ["canvas"],
  text: [
    "txt", "log", "csv", "tsv", "json", "xml", "yaml", "yml", "ini", "conf",
    "toml", "properties", "env", "js", "jsx", "ts", "tsx", "java", "py", "css",
    "scss", "html", "sh", "bat", "ps1", "sql", "go", "rs", "c", "cpp", "h",
    "cs", "rb", "php", "kt", "gradle",
  ],
  audio: ["mp3", "wav", "ogg", "m4a", "flac", "aac"],
  video: ["mp4", "webm", "mov", "m4v"],
};

const KIND_BY_EXTENSION = Object.freeze(
  Object.fromEntries(
    Object.entries(KIND_EXTENSIONS).flatMap(([kind, exts]) =>
      exts.map((ext) => [ext, kind]),
    ),
  ),
);

/** Plain text MIME used for every text-like kind (never html/svg/xml) */
export const TEXT_PLAIN_MIME = "text/plain;charset=utf-8";

/** Fallback MIME for anything unknown (browsers download rather than render it) */
export const OCTET_STREAM_MIME = "application/octet-stream";

/** Real MIME for SVG. Only used internally to build data: URLs, never for object URLs. */
const SVG_MIME = "image/svg+xml";

/** Binary MIME types that are safe to hand to URL.createObjectURL */
const BINARY_MIME_TYPES = Object.freeze({
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/mp4",
});

/**
 * MIME types to try with HTMLMediaElement.canPlayType(), most likely first.
 * QuickTime and M4V files are usually plain MP4 containers, so try video/mp4 first.
 */
const PLAYBACK_MIME_CANDIDATES = Object.freeze({
  mov: ["video/mp4", "video/quicktime"],
  m4v: ["video/mp4", "video/x-m4v"],
});

const MB = 1024 * 1024;

/** Preview size limits in bytes per kind */
const PREVIEW_LIMITS = Object.freeze({
  image: 50 * MB,
  pdf: 100 * MB,
  text: 5 * MB,
  markdown: 5 * MB,
  canvas: 5 * MB,
  audio: 250 * MB,
  video: 250 * MB,
});

/** Lower media limit for touch devices (phones/tablets have far less memory) */
const COARSE_POINTER_MEDIA_LIMIT = 100 * MB;

/** Units accepted by parseSizeString (binary, matching the backend's ByteSizes.format) */
const SIZE_UNITS = Object.freeze({
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
});

/** How long temporary object URLs (downloads, new tabs) stay alive */
const TEMP_URL_TTL_MS = 60 * 1000;

/**
 * Extracts the lower-cased extension (without the dot) from a file name or path.
 * Only the last path segment is considered, and dotfiles like ".env" yield "env".
 * @param {string} name - File name or path
 * @returns {string} The extension, or "" when there is none
 */
export function getExtension(name) {
  if (!name || typeof name !== "string") return "";
  const base = name.slice(
    Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1,
  );
  const dot = base.lastIndexOf(".");
  if (dot === -1 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

/**
 * Normalizes a name-or-extension argument to a bare lower-case extension.
 * "PDF", ".pdf" and "report.pdf" all become "pdf".
 */
function toExtension(nameOrExt) {
  if (!nameOrExt || typeof nameOrExt !== "string") return "";
  if (/[./\\]/.test(nameOrExt)) return getExtension(nameOrExt);
  return nameOrExt.toLowerCase();
}

/**
 * Returns the preview kind for a file name or bare extension.
 * @param {string} nameOrExt - e.g. "notes.md", "md" or "PNG"
 * @returns {'image'|'pdf'|'markdown'|'canvas'|'text'|'audio'|'video'|null}
 */
export function getFileKind(nameOrExt) {
  const ext = toExtension(nameOrExt);
  if (!ext) return null;
  return Object.prototype.hasOwnProperty.call(KIND_BY_EXTENSION, ext)
    ? KIND_BY_EXTENSION[ext]
    : null;
}

/**
 * Returns a MIME type that is safe to use for a Blob of this extension.
 * Text-like kinds (including html, xml, json, markdown and canvas) become text/plain,
 * SVG and unknown types become application/octet-stream. Never returns html/svg/xml.
 * @param {string} ext - Extension or file name
 * @returns {string} MIME type
 */
export function getMimeType(ext) {
  const e = toExtension(ext);
  const kind = getFileKind(e);
  if (kind === "text" || kind === "markdown" || kind === "canvas") {
    return TEXT_PLAIN_MIME;
  }
  if (Object.prototype.hasOwnProperty.call(BINARY_MIME_TYPES, e)) {
    return BINARY_MIME_TYPES[e];
  }
  return OCTET_STREAM_MIME;
}

/**
 * Returns the MIME types to probe with canPlayType() for an audio/video extension.
 * @param {string} ext - Extension or file name
 * @returns {string[]} Candidate MIME types, most likely first (empty for non-media)
 */
export function getPlaybackMimeCandidates(ext) {
  const e = toExtension(ext);
  const kind = getFileKind(e);
  if (kind !== "audio" && kind !== "video") return [];
  return PLAYBACK_MIME_CANDIDATES[e] || [BINARY_MIME_TYPES[e]];
}

/**
 * Parses a human-readable size produced by the backend (ByteSizes.format),
 * e.g. "512 B", "2.4 MB" or "1,5 GB" (comma decimals from non-English locales).
 * @param {string} str - Size label
 * @returns {number|null} Size in bytes, or null when it can't be parsed
 */
export function parseSizeString(str) {
  if (typeof str !== "string") return null;
  const match = /^\s*(\d{1,15}(?:[.,]\d{1,6})?)\s*(B|KB|MB|GB|TB)\s*$/i.exec(
    str,
  );
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * SIZE_UNITS[match[2].toUpperCase()]);
}

/** True when the primary pointer is coarse (touch devices) */
function isCoarsePointer() {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    );
  } catch {
    return false;
  }
}

/**
 * Returns the maximum size in bytes that will be previewed for a kind.
 * Audio/video drop to 100 MB on touch devices.
 * @param {string} kind - Preview kind from getFileKind()
 * @returns {number} Limit in bytes (0 for unknown kinds)
 */
export function getPreviewLimit(kind) {
  if (!kind || !Object.prototype.hasOwnProperty.call(PREVIEW_LIMITS, kind)) {
    return 0;
  }
  if ((kind === "audio" || kind === "video") && isCoarsePointer()) {
    return COARSE_POINTER_MEDIA_LIMIT;
  }
  return PREVIEW_LIMITS[kind];
}

/**
 * Whether a file of this kind and size should open in the previewer.
 * An unknown size (null) is allowed; the download stream enforces the limit instead.
 * @param {string|null} kind - Preview kind from getFileKind()
 * @param {number|null} bytes - File size in bytes, or null when unknown
 * @returns {boolean}
 */
export function canPreview(kind, bytes) {
  const limit = getPreviewLimit(kind);
  if (limit <= 0) return false;
  if (bytes === null || bytes === undefined) return true;
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return false;
  }
  return bytes <= limit;
}

/**
 * Whether a blob of this kind may be opened in a new browser tab.
 * Only PDFs, raster images, audio and video. Never SVG or any text kind,
 * because a same-origin blob tab could run script with access to the session.
 * @param {string|null} kind - Preview kind
 * @param {string} ext - Extension or file name
 * @returns {boolean}
 */
export function allowsOpenInNewTab(kind, ext) {
  const e = toExtension(ext);
  if (kind === "pdf") return e === "pdf";
  if (kind === "image") return e !== "svg" && getFileKind(e) === "image";
  if (kind === "audio" || kind === "video") return getFileKind(e) === kind;
  return false;
}

/**
 * Returns a view of the blob with a safe MIME type for its extension
 * (see getMimeType). Text, markdown and canvas become text/plain;charset=utf-8.
 * @param {Blob} blob - Source blob
 * @param {string} ext - Extension or file name
 * @returns {Blob}
 */
export function retypeBlob(blob, ext) {
  const type = getMimeType(ext);
  if (blob.type === type) return blob;
  return blob.slice(0, blob.size, type);
}

/** Reads a blob as a data: URL via FileReader */
function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Creates a URL suitable for <img>/<iframe>/<video> display.
 * SVG becomes a data: URL (opaque origin, so its scripts can never reach the JWT);
 * everything else becomes an object URL of the retyped blob.
 * @param {Blob} blob - File contents
 * @param {string} ext - Extension or file name
 * @returns {Promise<{url: string, revoke: Function}>} Call revoke() when done
 */
export async function blobToDisplayUrl(blob, ext) {
  if (toExtension(ext) === "svg") {
    const svgBlob = blob.slice(0, blob.size, SVG_MIME);
    const url = await readAsDataUrl(svgBlob);
    return { url, revoke: () => {} };
  }
  const url = URL.createObjectURL(retypeBlob(blob, ext));
  let revoked = false;
  return {
    url,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * Saves a blob to disk under the given name.
 * The blob is re-wrapped as application/octet-stream so the browser always
 * downloads it, and the object URL is revoked after 60 s (revoking immediately
 * can cancel the download in some browsers).
 * @param {Blob} blob - File contents
 * @param {string} name - Suggested file name
 */
export function saveBlobAs(blob, name) {
  const url = URL.createObjectURL(blob.slice(0, blob.size, OCTET_STREAM_MIME));
  const link = document.createElement("a");
  link.href = url;
  link.download = name || "download";
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), TEMP_URL_TTL_MS);
  }
}

/**
 * Opens a blob in a new browser tab using its own object URL, revoked after 60 s.
 * Does nothing unless allowsOpenInNewTab() permits the extension.
 * Must be called from a user gesture (click) to avoid popup blocking.
 * @param {Blob} blob - File contents
 * @param {string} ext - Extension or file name
 * @param {object} [options]
 * @param {string} [options.type] - Audio/video only: the MIME type to open it as
 *   instead of the extension's, e.g. the one canPlayType() accepted, so a .mov
 *   plays as video/mp4 rather than downloading as video/quicktime. Ignored unless
 *   it is one of getPlaybackMimeCandidates(ext).
 */
export function openBlobInNewTab(blob, ext, options = {}) {
  const e = toExtension(ext);
  if (!blob || !allowsOpenInNewTab(getFileKind(e), e)) return;
  const type = options ? options.type : undefined;
  const typed =
    type && getPlaybackMimeCandidates(e).includes(type)
      ? blob.slice(0, blob.size, type)
      : retypeBlob(blob, e);
  const url = URL.createObjectURL(typed);
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), TEMP_URL_TTL_MS);
  }
}

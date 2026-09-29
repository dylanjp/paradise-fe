/**
 * Safe URL Module
 * Validates URLs coming from untrusted markdown/HTML before they are placed in
 * href/src attributes. Uses the WHATWG URL parser (the same algorithm the browser
 * uses) so tricks like "java\tscript:" or leading control characters can't slip by.
 */

/** Fake base used to resolve relative URLs; ".invalid" can never be a real host */
export const RELATIVE_URL_BASE = "https://rel.invalid/";
const RELATIVE_HOST = "rel.invalid";

/** Image data: URLs allowed in <img src>. SVG is safe inside <img> (no script runs). */
const SAFE_DATA_IMAGE =
  /^data:image\/(?:png|jpeg|gif|webp|avif|bmp|svg\+xml)[;,]/i;

/** Named character references that matter for URL smuggling, plus the common ones */
const NAMED_ENTITIES = Object.freeze({
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  colon: ":",
  Tab: "\t",
  NewLine: "\n",
  lpar: "(",
  rpar: ")",
  sol: "/",
  bsol: "\\",
  period: ".",
  num: "#",
  quest: "?",
  equals: "=",
  excl: "!",
  percnt: "%",
  plus: "+",
  comma: ",",
  semi: ";",
  lowbar: "_",
  grave: "`",
  commat: "@",
});

const ENTITY_PATTERN =
  /&(?:#(\d{1,8});?|#[xX]([0-9a-fA-F]{1,7});?|([A-Za-z][A-Za-z0-9]{1,31});)/g;

/** Converts a numeric character reference to a string (invalid code points become U+FFFD) */
function fromCodePointSafe(code) {
  if (
    !Number.isFinite(code) ||
    code <= 0 ||
    code > 0x10ffff ||
    (code >= 0xd800 && code <= 0xdfff)
  ) {
    return "\ufffd";
  }
  return String.fromCodePoint(code);
}

/**
 * Decodes HTML character references (numeric, hex and the named ones above).
 * Unknown named references are left untouched.
 * @param {string} value - Text that may contain entities
 * @returns {string} Decoded text
 */
export function decodeHtmlEntities(value) {
  if (typeof value !== "string" || value.indexOf("&") === -1) return value;
  return value.replace(ENTITY_PATTERN, (match, dec, hex, name) => {
    if (dec !== undefined) return fromCodePointSafe(parseInt(dec, 10));
    if (hex !== undefined) return fromCodePointSafe(parseInt(hex, 16));
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
      ? NAMED_ENTITIES[name]
      : match;
  });
}

/** Decodes entities, trims and parses a URL; returns null if it can't be parsed */
function parse(value) {
  if (typeof value !== "string") return null;
  const cleaned = decodeHtmlEntities(value).trim();
  if (!cleaned) return null;
  try {
    return { cleaned, url: new URL(cleaned, RELATIVE_URL_BASE) };
  } catch {
    return null;
  }
}

/**
 * Validates a URL for use in href (default) or img src ({ img: true }).
 * Allowed: http:, https:, relative URLs and #fragments; links may also use
 * mailto: and tel:, images may also use data:image/(png|jpeg|gif|webp|avif|bmp|svg+xml).
 * Everything else (javascript:, vbscript:, blob:, file:, other data: ...) is rejected.
 * @param {string} value - Candidate URL (may contain HTML entities)
 * @param {{img?: boolean}} [options]
 * @returns {string|null} The decoded, trimmed URL, or null when unsafe
 */
export function safeUrl(value, { img = false } = {}) {
  const parsed = parse(value);
  if (!parsed) return null;
  const { cleaned, url } = parsed;

  switch (url.protocol) {
    case "http:":
    case "https:":
      return cleaned;
    case "mailto:":
    case "tel:":
      return img ? null : cleaned;
    case "data:":
      return img && SAFE_DATA_IMAGE.test(url.href.slice(0, 64))
        ? cleaned
        : null;
    default:
      return null;
  }
}

/**
 * Whether a URL is relative to the current document (a path, not a scheme or
 * another host). Fragment-only and query-only references count as relative too.
 * @param {string} value - Candidate URL (may contain HTML entities)
 * @returns {boolean}
 */
export function isRelativeUrl(value) {
  const parsed = parse(value);
  if (!parsed) return false;
  const { cleaned, url } = parsed;
  if (url.protocol !== "https:" || url.host !== RELATIVE_HOST) return false;
  // "https://rel.invalid/x" and "//rel.invalid/x" name the fake host explicitly
  return !/^[a-z][a-z0-9+.-]*:|^[\\/]{2}/i.test(
    cleaned.replace(/[\t\n\r]/g, ""),
  );
}

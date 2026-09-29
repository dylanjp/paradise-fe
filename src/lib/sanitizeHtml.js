/**
 * HTML Sanitizer
 * Strict allowlist sanitizer for rendered markdown (Documentation and Drive previews).
 *
 * Rendered content is treated as hostile: Drive files come from other users and the
 * JWT lives in localStorage, so a single script execution would leak the session.
 * The input is parsed with DOMParser (an inert document: no scripts run, no images
 * load) and a fresh tree is rebuilt from an allowlist: allowed elements are recreated
 * with only their allowed attributes, dangerous ones are dropped with their content,
 * and everything else is unwrapped (its text kept). It never assigns to a detached
 * innerHTML.
 *
 * Blob URLs are always rejected here; hydration code assigns them after sanitizing,
 * and any DOM it builds must use textContent/createElement only.
 */

import { safeUrl } from "./safeUrl";

const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Elements that are kept (with their allowed attributes) */
// prettier-ignore
const ALLOWED_ELEMENTS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "a", "img", "em",
  "strong", "del", "s", "code", "pre", "blockquote", "ul", "ol", "li", "table",
  "thead", "tbody", "tr", "th", "td", "span", "div", "mark", "sup", "sub",
  "input",
]);

/** Elements removed together with everything inside them */
// prettier-ignore
const DROP_WITH_CONTENT = new Set([
  "script", "style", "template", "noscript", "noembed", "noframes", "xmp",
  "plaintext", "iframe", "object", "embed", "svg", "math", "title", "textarea",
  "select", "form",
]);

/** data-* attributes used by the docs viewer; all others are dropped */
const ALLOWED_DATA_ATTRIBUTES = new Set([
  "data-doc-link",
  "data-embed-target",
  "data-embed-from",
  "data-embed-literal",
  "data-embed-pdf",
  "data-embed-note",
]);

/**
 * Heading ids made by renderObsidianMarkdown: "docs-h-" plus a slug of lower-case
 * or uncased letters, marks, digits, "_"-like characters and "-" (see
 * slugifyHeading). Nothing in it needs escaping inside a quoted CSS attribute
 * selector.
 */
export const HEADING_ID_RE =
  /^docs-h-[\p{Ll}\p{Lm}\p{Lo}\p{M}\p{Nd}\p{Nl}\p{Pc}-]+$/u;

const DIMENSION = /^\d{1,5}$/;
const ALIGN_VALUES = new Set(["left", "center", "right", "justify"]);
const LIST_START = /^-?\d{1,9}$/;
const SPAN_VALUE = /^\d{1,4}$/;
const LOADING_VALUES = new Set(["lazy", "eager"]);
const DECODING_VALUES = new Set(["async", "sync", "auto"]);

/**
 * Returns the sanitized value for one attribute, or null to drop it.
 * @param {string} tag - Lower-case element name
 * @param {string} name - Lower-case attribute name
 * @param {string} value - Attribute value (already entity-decoded by the parser)
 */
function sanitizeAttribute(tag, name, value) {
  if (ALLOWED_DATA_ATTRIBUTES.has(name)) return value;

  switch (name) {
    case "class":
      return value;
    case "id":
      return HEADING_ID_RE.test(value) ? value : null;
    case "align":
      return ALIGN_VALUES.has(value.toLowerCase()) ? value.toLowerCase() : null;
    case "start":
      return tag === "ol" && LIST_START.test(value) ? value : null;
    case "colspan":
    case "rowspan":
      return (tag === "td" || tag === "th") && SPAN_VALUE.test(value)
        ? value
        : null;
    case "title":
      return tag === "a" || tag === "img" ? value : null;
    case "href":
      return tag === "a" ? safeUrl(value) : null;
    case "target":
      return tag === "a" && value.toLowerCase() === "_blank" ? "_blank" : null;
    case "src":
      return tag === "img" ? safeUrl(value, { img: true }) : null;
    case "alt":
      return tag === "img" ? value : null;
    case "width":
    case "height":
      return tag === "img" && DIMENSION.test(value) ? value : null;
    case "loading":
      return tag === "img" && LOADING_VALUES.has(value) ? value : null;
    case "decoding":
      return tag === "img" && DECODING_VALUES.has(value) ? value : null;
    case "checked":
      return tag === "input" ? "" : null;
    default:
      return null;
  }
}

/** Copies the allowed attributes of a source element onto its fresh replacement */
function copyAttributes(source, target, tag) {
  for (const attr of Array.from(source.attributes)) {
    const name = attr.name.toLowerCase();
    // Namespaced attributes (xlink:href, xml:base ...) are never allowed
    if (attr.namespaceURI || name.includes(":")) continue;
    const value = sanitizeAttribute(tag, name, attr.value);
    if (value !== null) target.setAttribute(name, value);
  }

  if (tag === "a" && target.getAttribute("target") === "_blank") {
    target.setAttribute("rel", "noopener noreferrer");
  }
  if (tag === "input") {
    target.setAttribute("type", "checkbox");
    target.setAttribute("disabled", "");
  }
}

/** Whether an <input> is the only kind we keep: a checkbox (task list item) */
function isCheckbox(el) {
  return (el.getAttribute("type") || "").trim().toLowerCase() === "checkbox";
}

/**
 * Rebuilds the allowed content of `source` inside `target`.
 * Iterative depth-first walk in document order, so deeply nested input can't
 * overflow the stack, and nothing is moved (unwrapping is linear).
 */
function rebuild(source, target, doc) {
  const stack = [];
  for (let c = source.lastChild; c; c = c.previousSibling)
    stack.push([c, target]);

  while (stack.length > 0) {
    const [node, parent] = stack.pop();

    if (node.nodeType === TEXT_NODE) {
      parent.appendChild(doc.createTextNode(node.data));
      continue;
    }
    // Comments, processing instructions, doctypes: dropped
    if (node.nodeType !== ELEMENT_NODE) continue;

    const tag = String(node.localName).toLowerCase();
    if (node.namespaceURI !== HTML_NAMESPACE || DROP_WITH_CONTENT.has(tag))
      continue;

    let childParent = parent;
    if (ALLOWED_ELEMENTS.has(tag)) {
      if (tag === "input" && !isCheckbox(node)) continue;
      const el = doc.createElement(tag);
      copyAttributes(node, el, tag);
      parent.appendChild(el);
      childParent = el;
    }
    // Allowed: children go into the copy. Anything else: unwrapped in place.
    for (let c = node.lastChild; c; c = c.previousSibling) {
      stack.push([c, childParent]);
    }
  }
}

/**
 * Sanitizes an HTML string against a strict allowlist.
 * Only the parsed <body> is kept, so anything the parser places in <head> is dropped.
 * Fails closed: if parsing or serializing throws, the result is "".
 * @param {string} html - Untrusted HTML (e.g. marked output)
 * @returns {string} Safe HTML, or "" when DOMParser is unavailable (SSR/build)
 */
export function sanitizeHtml(html) {
  if (typeof DOMParser === "undefined") return "";
  if (html === null || html === undefined || html === "") return "";

  try {
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    if (!doc.body) return "";

    const output = doc.createElement("div");
    rebuild(doc.body, output, doc);
    return output.innerHTML;
  } catch {
    return "";
  }
}

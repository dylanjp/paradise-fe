/**
 * Docs Embed Hydration
 * Fills in the embed placeholders that renderObsidianMarkdown() emits, after the
 * sanitized HTML is already in the page:
 *
 * - images  (img[data-embed-target]): src from the resource cache; a file that can't
 *   be loaded is replaced by a ".docs-embed-missing" label
 * - PDFs    ([data-embed-pdf]): an inline iframe where the browser can show PDFs,
 *   otherwise a Download button
 * - notes   ([data-embed-note]): the note's text is fetched, rendered with
 *   embedDepth 1, currentPath = the embedded note and its own heading idPrefix,
 *   sanitized, inserted and hydrated in turn. Only note embeds of the host doc
 *   expand: one inside an embedded note (raw HTML can still carry the attribute)
 *   or one pointing back at a note already open on that chain becomes a link.
 *
 * Security: every string that comes from a doc (targets, paths, names) is only
 * ever written with textContent / setAttribute; object URLs are assigned here,
 * after sanitizing (sanitizeHtml rejects blob: URLs). Embedded note HTML is
 * rendered and sanitized before it is parsed into the page.
 *
 * Hydration never re-renders the host's HTML, so an animation running on the
 * original text (BlogAnimator) is not restarted.
 */

import { renderObsidianMarkdown } from "./obsidian";
import { sanitizeHtml, HEADING_ID_RE } from "./sanitizeHtml";

/** Set on an embed element once its final content is in place */
const DONE_ATTR = "data-embed-done";

/** Class of the element holding an embedded note's rendered body */
const NOTE_BODY_CLASS = "docs-embed-note-body";

/** Start loading lazy embeds a little before they scroll into view */
const LAZY_ROOT_MARGIN = "600px 0px";

let fragmentCount = 0;

/**
 * A new heading idPrefix for renderObsidianMarkdown ("f1-", "f2-", ...), so every
 * fragment rendered on the page (an embedded note, a canvas node) gets its own
 * heading ids and same-note links point at them.
 * @returns {string}
 */
export function nextFragmentIdPrefix() {
  fragmentCount += 1;
  return `f${fragmentCount}-`;
}

/**
 * Finds the heading a "#docs-h-..." link points at, searching only the rendered
 * fragment the link belongs to: the host doc, or the embedded note body it sits
 * in. A heading with the same id in another fragment is never picked.
 * @param {Element} root - Container of the host doc (or canvas node)
 * @param {Element} anchor - The clicked link
 * @param {string} id - Heading id, without "#"
 * @returns {Element|null}
 */
export function findHeadingForLink(root, anchor, id) {
  if (!root || !anchor || !HEADING_ID_RE.test(id)) return null;
  const fragmentOf = (el) => {
    const body = el.closest(`.${NOTE_BODY_CLASS}`);
    return body && root.contains(body) ? body : root;
  };
  const fragment = fragmentOf(anchor);
  for (const el of fragment.querySelectorAll(`[id="${id}"]`)) {
    if (fragmentOf(el) === fragment) return el;
  }
  return null;
}

/** Last path segment ("a/b/pic.png" -> "pic.png") */
function basename(path) {
  const clean = String(path ?? "").replace(/\\/g, "/");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/** Display name of a note path ("a/Daken.md" -> "Daken") */
function noteTitle(path) {
  return basename(path).replace(/\.md$/i, "") || "Note";
}

/** Whether a rejection came from cancelling / disposing (not a real failure) */
function isAbortError(err) {
  return !!err && err.name === "AbortError";
}

/** Whether the browser can show PDFs inline (false on most phones) */
function detectPdfViewer() {
  try {
    return typeof navigator === "undefined" || navigator.pdfViewerEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Replaces an element's children with already-sanitized HTML.
 * The HTML is parsed in an inert DOMParser document and the nodes are imported,
 * so nothing is parsed into a detached element of the live document.
 */
function setSanitizedHtml(el, safeHtml) {
  if (typeof DOMParser === "undefined") return;
  const doc = el.ownerDocument;
  const parsed = new DOMParser().parseFromString(safeHtml, "text/html");
  const nodes = Array.from(parsed.body.childNodes, (n) => doc.importNode(n, true));
  el.replaceChildren(...nodes);
}

/** Starts a download of an object URL under a file name */
function downloadUrl(doc, url, name) {
  const link = doc.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  doc.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}

/**
 * Hydrates every embed placeholder inside `root` (and inside embedded notes).
 * Safe to call again on the same root after cancelling: finished embeds are
 * skipped, unfinished ones are retried.
 *
 * @param {Element} root - Element holding sanitized, rendered markdown
 * @param {{getEmbedUrl: Function, getText: Function}} cache - createDocsResourceCache() result
 * @param {object} [options]
 * @param {object|null} [options.index] - buildDocsIndex() result, for links in embedded notes
 * @param {Element|null} [options.scrollRoot] - Scroll container used for lazy loading
 * @param {boolean} [options.lazy=true] - Defer images/PDFs until they near the viewport
 *   (only when IntersectionObserver exists; otherwise everything loads right away)
 * @param {boolean} [options.pdfViewerEnabled] - Override inline-PDF detection
 * @returns {() => void} Cancel function: stops pending work and ignores late results
 */
export function hydrateDocsEmbeds(root, cache, options = {}) {
  const {
    index = null,
    scrollRoot = null,
    lazy = true,
    pdfViewerEnabled = detectPdfViewer(),
  } = options;

  if (!root || !cache || typeof root.querySelectorAll !== "function") {
    return () => {};
  }

  const doc = root.ownerDocument;
  const seen = new WeakSet();
  const lazyJobs = new Map();
  let cancelled = false;
  let observer = null;

  if (lazy && typeof IntersectionObserver === "function") {
    try {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const job = lazyJobs.get(entry.target);
            lazyJobs.delete(entry.target);
            observer.unobserve(entry.target);
            if (job && !cancelled) job();
          }
        },
        { root: scrollRoot || null, rootMargin: LAZY_ROOT_MARGIN },
      );
    } catch {
      observer = null;
    }
  }

  /** Runs a job now, or once the element nears the viewport */
  function whenVisible(el, job) {
    if (observer) {
      lazyJobs.set(el, job);
      observer.observe(el);
    } else {
      job();
    }
  }

  /** A ".docs-embed-missing" label (text only) */
  function missingLabel(text, title) {
    const span = doc.createElement("span");
    span.className = "docs-embed-missing";
    span.setAttribute(DONE_ATTR, "");
    span.textContent = text;
    if (title) span.title = title;
    return span;
  }

  /** Swaps an embedded image for a "missing" label */
  function markImageMissing(img, target) {
    if (!img.parentNode) return;
    const label = missingLabel(`Missing image: ${basename(target) || "unknown file"}`, target);
    label.setAttribute("role", "img");
    label.setAttribute("aria-label", label.textContent);
    img.replaceWith(label);
  }

  /** Replaces a block embed's content with a "missing" label */
  function markBlockMissing(el, text, title) {
    el.replaceChildren(missingLabel(text, title));
    el.setAttribute(DONE_ATTR, "");
  }

  /** Shows a note embed that must not expand as a plain link to the note */
  function markNoteAsLink(el, path) {
    const link = doc.createElement("a");
    link.href = "#";
    link.className = "docs-internal-link docs-embed-link";
    link.setAttribute("data-doc-link", path);
    link.textContent = noteTitle(path);
    el.replaceChildren(link);
    el.setAttribute(DONE_ATTR, "");
  }

  /** Whether an element sits inside an embedded note's body below root */
  function insideEmbeddedNote(el) {
    const body = el.parentElement ? el.parentElement.closest(`.${NOTE_BODY_CLASS}`) : null;
    return !!body && root.contains(body);
  }

  function hydrateImage(img) {
    const target = img.getAttribute("data-embed-target") || "";
    const from = img.getAttribute("data-embed-from") || "";
    const literal = img.getAttribute("data-embed-literal") === "true";
    if (!target || !from) {
      markImageMissing(img, target);
      return;
    }

    whenVisible(img, () => {
      cache.getEmbedUrl(from, target, { literal }).then(
        (url) => {
          if (cancelled || !img.isConnected) return;
          img.addEventListener(
            "error",
            () => {
              if (!cancelled) markImageMissing(img, target);
            },
            { once: true },
          );
          img.setAttribute(DONE_ATTR, "");
          img.setAttribute("src", url);
          img.setAttribute("tabindex", "0");
        },
        (err) => {
          if (cancelled || isAbortError(err) || !img.isConnected) return;
          markImageMissing(img, target);
        },
      );
    });
  }

  function hydratePdf(el) {
    const target = el.getAttribute("data-embed-pdf") || "";
    const from = el.getAttribute("data-embed-from") || "";
    const literal = el.getAttribute("data-embed-literal") === "true";
    const name = basename(target) || "document.pdf";
    if (!target || !from) {
      markBlockMissing(el, `Missing PDF: ${name}`, target);
      return;
    }

    whenVisible(el, () => {
      cache.getEmbedUrl(from, target, { literal }).then(
        (url) => {
          if (cancelled || !el.isConnected) return;
          if (pdfViewerEnabled) {
            const frame = doc.createElement("iframe");
            frame.setAttribute("title", name);
            frame.setAttribute("src", url);
            el.replaceChildren(frame);
          } else {
            const note = doc.createElement("span");
            note.className = "docs-embed-pdf-name";
            note.textContent = name;
            const button = doc.createElement("button");
            button.type = "button";
            button.className = "docs-embed-download";
            button.textContent = "Download PDF";
            button.setAttribute("aria-label", `Download ${name}`);
            button.addEventListener("click", () => downloadUrl(doc, url, name));
            el.replaceChildren(note, button);
          }
          el.setAttribute(DONE_ATTR, "");
        },
        (err) => {
          if (cancelled || isAbortError(err) || !el.isConnected) return;
          markBlockMissing(el, `Missing PDF: ${name}`, target);
        },
      );
    });
  }

  /**
   * @param {Element} el - [data-embed-note] placeholder
   * @param {Set<string>} chain - Note paths already open above el
   */
  function hydrateNote(el, chain) {
    const path = el.getAttribute("data-embed-note") || "";
    if (!path) {
      markBlockMissing(el, "Missing note", "");
      return;
    }

    // Only the host doc's note embeds expand. The renderer never emits one inside
    // an embedded note (embedDepth 1), but raw HTML can, and each level would
    // fetch and render again (forever, for a note that embeds itself).
    const from = el.getAttribute("data-embed-from");
    if (insideEmbeddedNote(el) || chain.has(path) || path === from) {
      markNoteAsLink(el, path);
      return;
    }
    const nextChain = new Set(chain).add(path);

    cache.getText(path).then(
      (text) => {
        if (cancelled || !el.isConnected) return;
        const html = sanitizeHtml(
          renderObsidianMarkdown(text, {
            currentPath: path,
            index,
            embedDepth: 1,
            idPrefix: nextFragmentIdPrefix(),
          }),
        );

        const title = doc.createElement("a");
        title.href = "#";
        title.className = "docs-internal-link docs-embed-note-title";
        title.setAttribute("data-doc-link", path);
        title.textContent = noteTitle(path);

        const body = doc.createElement("div");
        body.className = NOTE_BODY_CLASS;
        el.replaceChildren(title, body);
        setSanitizedHtml(body, html);
        el.setAttribute(DONE_ATTR, "");
        hydrateWithin(body, nextChain);
      },
      (err) => {
        if (cancelled || isAbortError(err) || !el.isConnected) return;
        markBlockMissing(el, `Could not load embedded note: ${noteTitle(path)}`, path);
      },
    );
  }

  /**
   * Hydrates every unfinished embed inside a container
   * @param {Element} container - root, or an embedded note's body
   * @param {Set<string>} chain - Note paths open above the container
   */
  function hydrateWithin(container, chain) {
    if (cancelled) return;
    const pick = (selector) =>
      Array.from(container.querySelectorAll(`${selector}:not([${DONE_ATTR}])`)).filter(
        (el) => {
          if (seen.has(el)) return false;
          seen.add(el);
          return true;
        },
      );

    pick("img[data-embed-target]").forEach(hydrateImage);
    pick("[data-embed-pdf]").forEach(hydratePdf);
    pick("[data-embed-note]").forEach((el) => hydrateNote(el, chain));
  }

  hydrateWithin(root, new Set());

  return function cancel() {
    if (cancelled) return;
    cancelled = true;
    lazyJobs.clear();
    if (observer) observer.disconnect();
  };
}

/**
 * Obsidian Markdown Module
 * Renders Obsidian-flavoured markdown to HTML and resolves links between docs.
 *
 * Supported syntax on top of GFM: ![[embeds]], [[wikilinks|alias]], #tags,
 * ==highlights== and leading YAML frontmatter (stripped).
 *
 * The output is NOT safe on its own: always pass it through sanitizeHtml() before
 * inserting it into the page. Every renderer branch that emits a URL or attribute
 * is still owned here (marked 16 leaves image alt unescaped and passes javascript:
 * links through), so the markup is well-formed before the sanitizer sees it.
 *
 * Embed markup contract (hydrated later by the viewer):
 * - images: <img class="docs-embed-image" data-embed-target data-embed-from ...>
 * - PDFs:   <div class="docs-embed-pdf" data-embed-pdf data-embed-from></div>
 * - notes:  <div class="docs-embed-note" data-embed-note="TREE_PATH" data-embed-from></div>
 *           (depth 0 only)
 * - links:  <a href="#" class="docs-internal-link" data-doc-link="TREE_PATH">
 *
 * Only http(s) and data:image URLs ever reach an <img src>; relative image paths
 * become data-embed-target and are fetched through the authenticated embed endpoint.
 */

import { Marked } from "marked";
import { getExtension, getFileKind } from "./fileTypes";
import {
  safeUrl,
  isRelativeUrl,
  decodeHtmlEntities,
  RELATIVE_URL_BASE,
} from "./safeUrl";

/** Extensions that can appear in the docs tree; links without one imply ".md" */
const DOC_EXTENSIONS = new Set([
  "md",
  "canvas",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
]);

/** Bounded, newline-free patterns for the inline extensions */
const WIKI_EMBED_RE = /^!\[\[([^[\]\n]{1,1000})\]\]/;
const WIKI_LINK_RE = /^\[\[([^[\]\n]{1,1000})\]\]/;
const WIKI_ANY_RE = /!?\[\[[^[\]\n]{1,1000}\]\]/g;
const TAG_RE = /^#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/u;
const HIGHLIGHT_RE = /^==([^=\n]{1,500})==/;
const SIZE_RE = /^\s*(\d{1,5})(?:\s*x\s*(\d{1,5}))?\s*$/;

/** Allowed heading id prefixes (the sanitizer only keeps ids matching HEADING_ID_RE) */
const ID_PREFIX_RE = /^[a-z0-9-]{0,40}$/;

/**
 * Characters removed from (lower-cased) heading slugs: all but letters, marks,
 * digits, "_"-like characters, "-" and space. The rare letters with no lower-case
 * form go too, since the sanitizer's id rule only accepts lower-case/uncased ones.
 */
const SLUG_DROP_RE = /[^\p{Ll}\p{Lm}\p{Lo}\p{M}\p{Nd}\p{Nl}\p{Pc} -]/gu;
const SLUG_MAX_CHARS = 80;

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML content and double-quoted attribute values */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Attribute escaper (same rules; named separately for readability at call sites) */
const attr = escapeHtml;

/** decodeURIComponent that never throws (malformed escapes keep the raw text) */
function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Removes "?query" and "#fragment" from a relative URL */
function stripQueryAndFragment(url) {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Last path segment */
function basename(path) {
  const clean = String(path ?? "").replace(/\\/g, "/");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/** Basename without a known docs extension ("Daken/Daken.md" -> "Daken") */
function displayName(path) {
  const name = basename(path);
  const ext = getExtension(name);
  return ext && DOC_EXTENSIONS.has(ext)
    ? name.slice(0, name.length - ext.length - 1)
    : name;
}

/**
 * Normalizes a name or path for comparison: NFC, lower-case, "\" -> "/".
 * @param {string} s - Name or path
 * @returns {string} Comparison key
 */
export function normalizeKey(s) {
  return String(s ?? "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/\\/g, "/");
}

/**
 * Parses the inside of [[...]] / ![[...]].
 * Handles "path#heading", "path#^block", "path|alias", "path|300", "path|300x200"
 * and "path|alt|300". A "\|" (Obsidian's pipe escape inside tables) counts as "|".
 * @param {string} raw - Text between the brackets
 * @returns {{path: string, heading: string|null, alias: string|null,
 *            width: number|null, height: number|null, rawAlias: string|null}}
 *          rawAlias is everything after the first pipe (useful when a link's
 *          display text happens to look like a size, e.g. [[2024|300]]).
 */
export function parseWikiTarget(raw) {
  const text = String(raw ?? "");
  let target = text;
  let rawAlias = null;
  let alias = null;
  let width = null;
  let height = null;

  const pipe = text.indexOf("|");
  if (pipe !== -1) {
    target = text.slice(0, pipe);
    if (target.endsWith("\\")) target = target.slice(0, -1);
    rawAlias = text.slice(pipe + 1);

    const parts = rawAlias.split("|");
    const size = SIZE_RE.exec(parts[parts.length - 1]);
    if (size) {
      width = Number(size[1]);
      height = size[2] !== undefined ? Number(size[2]) : null;
      parts.pop();
    }
    const rest = parts
      .map((p) => (p.endsWith("\\") ? p.slice(0, -1) : p))
      .join("|")
      .trim();
    alias = rest || null;
  }

  let heading = null;
  const hash = target.indexOf("#");
  if (hash !== -1) {
    heading = target.slice(hash + 1).trim() || null;
    target = target.slice(0, hash);
  }

  return { path: target.trim(), heading, alias, width, height, rawAlias };
}

/**
 * Creates the byPath lookup: a null-prototype object keyed by tree path.
 * It also carries non-enumerable get()/has() helpers so it can be used like a Map.
 * (Tree file paths always carry an extension, so they can't collide with "get"/"has".)
 */
function createPathMap() {
  const map = Object.create(null);
  Object.defineProperties(map, {
    get: {
      value: (path) =>
        Object.prototype.hasOwnProperty.call(map, path) &&
        path !== "get" &&
        path !== "has"
          ? map[path]
          : undefined,
    },
    has: {
      value: (path) =>
        Object.prototype.hasOwnProperty.call(map, path) &&
        path !== "get" &&
        path !== "has",
    },
  });
  return map;
}

/**
 * Builds a lookup index of every file in the docs tree.
 * Top-level folders flagged root=true (extra vault roots such as "LE Docs") give
 * their files a rootLabel; files of the main DOCS_PATH root get rootLabel "".
 * @param {object|null} tree - Root DocsTreeNode ({name, type, path, children, root?})
 * @returns {{files: Array<{path, key, rootLabel, name, ext, kind}>, byPath: object,
 *            byKey: Map, byName: Map, rootLabels: string[]}}
 */
export function buildDocsIndex(tree) {
  const files = [];
  const byPath = createPathMap();
  const byKey = new Map();
  const byName = new Map();
  const rootLabels = [];

  if (!tree || typeof tree !== "object") {
    return { files, byPath, byKey, byName, rootLabels };
  }

  const stack = [[tree, ""]];
  while (stack.length > 0) {
    const [node, rootLabel] = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (node.type === "file" && typeof node.path === "string" && node.path) {
      const key = normalizeKey(node.path);
      const entry = {
        path: node.path,
        key,
        rootLabel,
        name: typeof node.name === "string" ? node.name : basename(node.path),
        ext: getExtension(node.path),
        kind: getFileKind(node.path),
      };
      files.push(entry);
      // "get"/"has" are the read-only helpers (tree files always have an extension)
      if (node.path !== "get" && node.path !== "has") byPath[node.path] = entry;
      if (!byKey.has(key)) byKey.set(key, entry);
      const nameKey = basename(key);
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(entry);
    }

    if (Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i];
        let childLabel = rootLabel;
        if (child && child.root === true && child.type === "folder") {
          childLabel = child.path || child.name || "";
          if (childLabel && !rootLabels.includes(childLabel)) {
            rootLabels.push(childLabel);
          }
        }
        stack.push([child, childLabel]);
      }
    }
  }

  return { files, byPath, byKey, byName, rootLabels };
}

/** Root label ("" for the main root) that a tree path belongs to */
function rootLabelOf(path, index) {
  if (!path) return "";
  const entry = index.byPath.get(path);
  if (entry) return entry.rootLabel;
  const first = String(path).split("/")[0];
  return (index.rootLabels || []).includes(first) ? first : "";
}

/** Directory segments of a normalized key */
function dirSegments(key) {
  const parts = key.split("/");
  parts.pop();
  return parts;
}

/** Number of leading segments two lists share */
function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** Resolves "./" and "../" segments of a key against a directory (lexically) */
function resolveRelativeKey(key, fromDir) {
  const out = [...fromDir];
  for (const seg of key.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else {
      out.push(seg);
    }
  }
  return out.join("/");
}

/**
 * Resolves a wikilink/markdown link target to a tree path, the way Obsidian does:
 * the candidate's path must equal the target or end with "/target" (".md" implied
 * when the target has no known extension). Only files in the same root as the
 * linking doc are considered, since separate vaults never link to each other.
 * Ties go to the file sharing the longest directory prefix with the linking doc,
 * then the shortest path.
 * @param {string} target - Link target (no "#heading" / "|alias")
 * @param {string|null} fromPath - Tree path of the doc containing the link
 * @param {object} index - Result of buildDocsIndex()
 * @returns {string|null} Tree path, or null when unresolved
 */
export function resolveDocLink(target, fromPath, index) {
  if (!index || !index.byName || typeof target !== "string") return null;

  let t = normalizeKey(target)
    .trim()
    .replace(/\/{2,}/g, "/");
  if (!t) return null;

  const fromRoot = rootLabelOf(fromPath, index);
  const fromDir = fromPath ? dirSegments(normalizeKey(fromPath)) : [];
  const ext = getExtension(t);
  const withExt = (k) => (ext && DOC_EXTENSIONS.has(ext) ? k : `${k}.md`);

  // Relative links ("./x", "../x") resolve against the linking doc's folder first
  if (/^\.\.?\//.test(t)) {
    const relKey = resolveRelativeKey(withExt(t), fromDir);
    const hit = relKey ? index.byKey.get(relKey) : null;
    if (hit && hit.rootLabel === fromRoot) return hit.path;
    t = t.replace(/^(?:\.\.?\/)+/, "");
  }

  t = withExt(t.replace(/^\/+/, ""));
  if (!t || t.endsWith("/")) return null;

  const candidates = (index.byName.get(basename(t)) || []).filter(
    (f) => f.rootLabel === fromRoot && (f.key === t || f.key.endsWith(`/${t}`)),
  );
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = null;
  for (const c of candidates) {
    const segs = c.key.split("/");
    const score = [
      -commonPrefixLength(dirSegments(c.key), fromDir),
      segs.length,
      c.key.length,
    ];
    if (
      best === null ||
      score[0] < bestScore[0] ||
      (score[0] === bestScore[0] &&
        (score[1] < bestScore[1] ||
          (score[1] === bestScore[1] &&
            (score[2] < bestScore[2] ||
              (score[2] === bestScore[2] && c.key < best.key)))))
    ) {
      best = c;
      bestScore = score;
    }
  }
  return best.path;
}

/**
 * Turns heading text into a slug for id="docs-h-<slug>", following GitHub's anchor
 * rules so hand-written tables of contents ([x](#some-heading)) keep working:
 * lower-case, drop every character that isn't a letter, mark, digit, "_", "-" or
 * space, then turn each space into "-". Runs of "-" are kept, as GitHub does
 * ("A — B" -> "a--b"), and so are Unicode letters ("Über" -> "über"). Cut to 80
 * characters; text with nothing left becomes "section".
 * Links and headings go through the same function, and a slug maps to itself.
 * @param {string} text - Heading text (or a link's "#fragment")
 * @returns {string} Slug that passes the sanitizer's heading id rule
 */
export function slugifyHeading(text) {
  const slug = String(text ?? "")
    .trim()
    .normalize("NFC")
    .toLowerCase()
    .replace(SLUG_DROP_RE, "")
    .replace(/ /g, "-")
    // Dropping can leave a letter next to a combining mark: compose again, so a
    // slug always maps to itself
    .normalize("NFC");
  // Cut on code points (a split surrogate pair would fail the id rule)
  const cut = Array.from(slug.slice(0, SLUG_MAX_CHARS * 2))
    .slice(0, SLUG_MAX_CHARS)
    .join("");
  return cut || "section";
}

/** Removes a leading YAML frontmatter block ("---" ... "---"), if it is closed */
function stripFrontmatter(src) {
  let text = src.charCodeAt(0) === 0xfeff ? src.slice(1) : src;
  if (!text.startsWith("---")) return text;
  const firstBreak = text.indexOf("\n");
  if (firstBreak === -1 || text.slice(0, firstBreak).trim() !== "---")
    return text;

  let pos = firstBreak + 1;
  while (pos <= text.length) {
    const nl = text.indexOf("\n", pos);
    const end = nl === -1 ? text.length : nl;
    const line = text.slice(pos, end).replace(/\r$/, "").trimEnd();
    if (line === "---" || line === "...") {
      return nl === -1 ? "" : text.slice(nl + 1);
    }
    if (nl === -1) break;
    pos = nl + 1;
  }
  return text;
}

/**
 * Protocol of an already-validated URL ("" for relative ones).
 * Protocol-relative URLs ("//host/x.png") count as remote (https:).
 */
function protocolOf(url) {
  if (isRelativeUrl(url)) return "";
  try {
    return new URL(url, RELATIVE_URL_BASE).protocol;
  } catch {
    return "";
  }
}

/** Renders ![[target]] */
function renderWikiEmbed(rawTarget, ctx) {
  const p = parseWikiTarget(rawTarget);
  const display = p.alias || displayName(p.path) || p.heading || rawTarget;
  if (!p.path) {
    return `<span class="docs-unresolved-link">${escapeHtml(display)}</span>`;
  }

  const kind = getFileKind(getExtension(p.path));

  if (kind === "image" && ctx.currentPath) {
    const alt = p.alias || basename(p.path);
    let size = "";
    if (p.width !== null) size += ` width="${p.width}"`;
    if (p.height !== null) size += ` height="${p.height}"`;
    return (
      `<img class="docs-embed-image" data-embed-target="${attr(p.path)}"` +
      ` data-embed-from="${attr(ctx.currentPath)}" alt="${attr(alt)}"${size}` +
      ` loading="lazy" decoding="async">`
    );
  }

  if (kind === "pdf" && ctx.currentPath) {
    return (
      `<div class="docs-embed-pdf" data-embed-pdf="${attr(p.path)}"` +
      ` data-embed-from="${attr(ctx.currentPath)}"></div>`
    );
  }

  const resolved = resolveDocLink(p.path, ctx.currentPath, ctx.index);
  if (
    resolved &&
    getFileKind(resolved) === "markdown" &&
    ctx.embedDepth === 0
  ) {
    const from = ctx.currentPath
      ? ` data-embed-from="${attr(ctx.currentPath)}"`
      : "";
    return `<div class="docs-embed-note" data-embed-note="${attr(resolved)}"${from}></div>`;
  }
  if (resolved) {
    return (
      `<a href="#" class="docs-internal-link docs-embed-link"` +
      ` data-doc-link="${attr(resolved)}">${escapeHtml(display)}</a>`
    );
  }
  return `<span class="docs-unresolved-link">${escapeHtml(display)}</span>`;
}

/** Renders [[target]] */
function renderWikiLink(rawTarget, ctx) {
  const p = parseWikiTarget(rawTarget);
  // For links, "|300" is display text rather than a size
  const alias =
    p.alias || (p.width !== null ? p.rawAlias.trim() : null) || null;

  if (!p.path) {
    if (!p.heading) return escapeHtml(`[[${rawTarget}]]`);
    return (
      `<a href="#docs-h-${ctx.idPrefix}${slugifyHeading(p.heading)}" class="docs-internal-link">` +
      `${escapeHtml(alias || p.heading)}</a>`
    );
  }

  let display = alias || displayName(p.path);
  if (!alias && p.heading) display += ` › ${p.heading}`;

  const resolved = resolveDocLink(p.path, ctx.currentPath, ctx.index);
  if (resolved) {
    return (
      `<a href="#" class="docs-internal-link"` +
      ` data-doc-link="${attr(resolved)}">${escapeHtml(display)}</a>`
    );
  }
  return `<span class="docs-unresolved-link">${escapeHtml(display)}</span>`;
}

/** Renders a markdown [text](href) link; unsafe targets become plain text */
function renderLink(href, title, innerHtml, ctx) {
  const decoded = decodeHtmlEntities(String(href ?? "")).trim();
  const titleAttr = title ? ` title="${attr(title)}"` : "";

  // Same-document heading link: [x](#My%20Heading)
  if (decoded.startsWith("#")) {
    const heading = safeDecodeURIComponent(decoded.slice(1)).trim();
    if (!heading) return innerHtml;
    return (
      `<a href="#docs-h-${ctx.idPrefix}${slugifyHeading(heading)}" class="docs-internal-link"` +
      `${titleAttr}>${innerHtml}</a>`
    );
  }

  const safe = safeUrl(decoded);
  if (safe === null) return innerHtml;

  if (isRelativeUrl(safe)) {
    // Relative links point at other docs; never emit them as real hrefs
    const path = safeDecodeURIComponent(stripQueryAndFragment(safe));
    const resolved = path
      ? resolveDocLink(path, ctx.currentPath, ctx.index)
      : null;
    if (resolved) {
      return (
        `<a href="#" class="docs-internal-link" data-doc-link="${attr(resolved)}"` +
        `${titleAttr}>${innerHtml}</a>`
      );
    }
    return `<span class="docs-unresolved-link">${innerHtml}</span>`;
  }

  return (
    `<a href="${attr(safe)}" target="_blank" rel="noopener noreferrer"` +
    `${titleAttr}>${innerHtml}</a>`
  );
}

/** Renders a markdown ![alt](src) image */
function renderImage(href, title, alt, ctx) {
  const altText = String(alt ?? "");
  const decoded = decodeHtmlEntities(String(href ?? "")).trim();
  const titleAttr = title ? ` title="${attr(title)}"` : "";

  // Relative image: served through the docs embed endpoint
  if (isRelativeUrl(decoded) && !/^[#?]/.test(decoded)) {
    const target = safeDecodeURIComponent(
      stripQueryAndFragment(decoded),
    ).trim();
    if (!target || !ctx.currentPath) return escapeHtml(altText);
    // After URL-decoding, "#", "|" and "^" are part of the file name itself
    const literal = /[#|^]/.test(target) ? ' data-embed-literal="true"' : "";
    return (
      `<img class="docs-embed-image" data-embed-target="${attr(target)}"` +
      ` data-embed-from="${attr(ctx.currentPath)}"${literal}` +
      ` alt="${attr(altText)}"${titleAttr} loading="lazy" decoding="async">`
    );
  }

  const safe = safeUrl(decoded, { img: true });
  if (safe === null) return escapeHtml(altText);

  // Only absolute http(s) and data:image URLs reach <img src>. Anything relative
  // left over here ("#frag", "?query") would load the app page itself as an image.
  const protocol = protocolOf(safe);
  if (protocol !== "http:" && protocol !== "https:" && protocol !== "data:") {
    return escapeHtml(altText);
  }
  if (
    (protocol === "http:" || protocol === "https:") &&
    !ctx.allowRemoteImages
  ) {
    return (
      `<a href="${attr(safe)}" target="_blank" rel="noopener noreferrer">` +
      `${escapeHtml(altText || safe)}</a>`
    );
  }

  return (
    `<img src="${attr(safe)}" alt="${attr(altText)}"${titleAttr}` +
    ` loading="lazy" decoding="async">`
  );
}

/**
 * Text inside raw <pre>/<code>/<script> is marked "escaped" (emitted verbatim).
 * With raw HTML disabled those tags are escaped too, so their text must be as well.
 * Walks the token tree the way marked's walkTokens does, but iteratively and in
 * linear time: walkTokens concatenates arrays per token, which is quadratic on a
 * paragraph with tens of thousands of inline tokens.
 */
function unescapeRawHtmlText(tokens) {
  const stack = [tokens];
  while (stack.length > 0) {
    for (const token of stack.pop()) {
      if (token.type === "text" && token.escaped) token.escaped = false;
      if (token.type === "table") {
        for (const cell of token.header) stack.push(cell.tokens);
        for (const row of token.rows) {
          for (const cell of row) stack.push(cell.tokens);
        }
      } else if (token.type === "list") {
        stack.push(token.items);
      } else if (Array.isArray(token.tokens)) {
        stack.push(token.tokens);
      }
    }
  }
}

/**
 * Whether the "#" at src[i] can start a tag: it opens the text or follows
 * whitespace, and a character other than whitespace or "#" comes next.
 */
function isTagStart(src, i) {
  if (i > 0 && !/\s/.test(src[i - 1])) return false;
  return i + 1 < src.length && !/[\s#]/.test(src[i + 1]);
}

/**
 * Keeps an inline extension's start() linear over a whole inline run.
 *
 * When no inline tokenizer matches, marked calls every start() with the rest of
 * the run (minus its first character) to learn how much plain text it may take.
 * Searching that afresh re-reads the remaining text once per text token, which is
 * quadratic on one long paragraph (a pasted log, or hostile input in a shared
 * Drive file).
 *
 * marked runs the extension tokenizers right before those start() calls and
 * passes them the run's token array, so each tokenizer reports the run with
 * see(). The first match is remembered as a distance from the end of the run:
 * marked only consumes a run from the front, so the answer stays valid until the
 * run moves past it, and each run is searched about once. Anything unexpected
 * (no token array, a length that doesn't line up) gets a fresh search.
 *
 * @param {string} trigger - Text every match starts with
 * @param {(src: string, i: number) => boolean} [accept] - Extra check for a trigger
 *   at src[i]; may only look at src[i - 1] and later (i === 0 starts the text)
 * @returns {{see: (src: string, tokens: Array) => void,
 *            start: (src: string) => (number|undefined)}}
 */
function createStartScanner(trigger, accept = () => true) {
  const searched = new WeakMap(); // run token array -> { length, matchFromEnd }
  let run = null;
  let runLength = -1;

  const find = (src) => {
    let i = src.indexOf(trigger);
    while (i !== -1 && !accept(src, i)) i = src.indexOf(trigger, i + 1);
    return i;
  };

  return {
    see(src, tokens) {
      run = Array.isArray(tokens) ? tokens : null;
      runLength = typeof src === "string" ? src.length : -1;
    },
    start(src) {
      const n = src.length;
      const sameRun = run !== null && n === runLength - 1;
      const known = sameRun ? searched.get(run) : undefined;
      if (known && n <= known.length) {
        // Index 0 has no preceding character here, so it's judged on its own
        if (src.startsWith(trigger) && accept(src, 0)) return 0;
        if (known.matchFromEnd === 0) return undefined;
        const i = n - known.matchFromEnd;
        if (i > 0) return i;
      }
      const i = find(src);
      if (sameRun) {
        searched.set(run, { length: n, matchFromEnd: i === -1 ? 0 : n - i });
      }
      return i === -1 ? undefined : i;
    },
  };
}

/** Builds a fresh Marked instance bound to one render's options */
function createMarked(ctx) {
  // GitHub's de-duplication: "a", "a" -> "a", "a-1"; a later heading that is
  // itself "a-1" becomes "a-1-1", so ids never repeat
  const slugCounts = new Map();
  const uniqueSlug = (slug) => {
    let result = slug;
    while (slugCounts.has(result)) {
      const count = slugCounts.get(slug) + 1;
      slugCounts.set(slug, count);
      result = `${slug}-${count}`;
    }
    slugCounts.set(result, 0);
    return result;
  };

  const extensions = [];

  if (ctx.wiki) {
    const embedScan = createStartScanner("![[");
    const linkScan = createStartScanner("[[");
    extensions.push(
      {
        name: "wikiEmbed",
        level: "inline",
        start: embedScan.start,
        tokenizer(src, tokens) {
          embedScan.see(src, tokens);
          const m = WIKI_EMBED_RE.exec(src);
          if (!m) return undefined;
          return { type: "wikiEmbed", raw: m[0], target: m[1] };
        },
        renderer(token) {
          return renderWikiEmbed(token.target, ctx);
        },
      },
      {
        name: "wikiLink",
        level: "inline",
        start: linkScan.start,
        tokenizer(src, tokens) {
          linkScan.see(src, tokens);
          if (this.lexer.state.inLink) return undefined;
          const m = WIKI_LINK_RE.exec(src);
          if (!m) return undefined;
          return { type: "wikiLink", raw: m[0], target: m[1] };
        },
        renderer(token) {
          return renderWikiLink(token.target, ctx);
        },
      },
    );
  }

  const tagScan = createStartScanner("#", isTagStart);
  const highlightScan = createStartScanner("==");

  /**
   * Whether src starts its inline run or follows whitespace. The character before
   * src is read from a longer rest of the same run the tag tokenizer saw earlier:
   * reading the end of the previous token's raw instead would copy it every time
   * (a merged text token grows with each piece), quadratic on long paragraphs.
   */
  const tagRunRest = new WeakMap();
  const startsRunOrFollowsSpace = (src, tokens) => {
    const prev = tokens && tokens.length > 0 ? tokens[tokens.length - 1] : null;
    let before = null;
    if (Array.isArray(tokens)) {
      const earlier = tagRunRest.get(tokens);
      tagRunRest.set(tokens, src);
      if (earlier && earlier.length > src.length) {
        before = earlier.charAt(earlier.length - src.length - 1);
      }
    }
    if (!prev) return true;
    if (before === null) {
      const raw = prev.raw || "";
      before = raw.charAt(raw.length - 1);
    }
    return /\s/.test(before);
  };

  extensions.push(
    {
      name: "tag",
      level: "inline",
      start: tagScan.start,
      tokenizer(src, tokens) {
        tagScan.see(src, tokens);
        // A tag must start the inline run or follow whitespace ("a#b" is not a tag)
        if (!startsRunOrFollowsSpace(src, tokens)) return undefined;
        const m = TAG_RE.exec(src);
        if (!m) return undefined;
        return { type: "tag", raw: m[0], tag: m[1] };
      },
      renderer(token) {
        return `<span class="docs-tag">#${escapeHtml(token.tag)}</span>`;
      },
    },
    {
      name: "highlight",
      level: "inline",
      start: highlightScan.start,
      tokenizer(src, tokens) {
        highlightScan.see(src, tokens);
        const m = HIGHLIGHT_RE.exec(src);
        if (!m) return undefined;
        return {
          type: "highlight",
          raw: m[0],
          text: m[1],
          tokens: this.lexer.inlineTokens(m[1]),
        };
      },
      renderer(token) {
        return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
      },
    },
  );

  const marked = new Marked({ gfm: true, breaks: true, async: false });

  marked.use({
    extensions,
    renderer: {
      heading({ tokens, depth, text }) {
        const slug = uniqueSlug(slugifyHeading(text));
        return (
          `<h${depth} id="docs-h-${ctx.idPrefix}${slug}">` +
          `${this.parser.parseInline(tokens)}</h${depth}>\n`
        );
      },
      link({ href, title, tokens }) {
        return renderLink(href, title, this.parser.parseInline(tokens), ctx);
      },
      image({ href, title, text }) {
        return renderImage(href, title, text, ctx);
      },
      html({ text, block }) {
        if (ctx.allowRawHtml) return text;
        const escaped = escapeHtml(text);
        return block ? `<p>${escaped}</p>\n` : escaped;
      },
    },
    hooks: {
      processAllTokens(tokens) {
        if (!ctx.allowRawHtml) unescapeRawHtmlText(tokens);
        return tokens;
      },
    },
  });

  if (ctx.wiki) {
    marked.use({
      hooks: {
        // Hide [[...]] from emphasis matching so "*" or "_" inside a link
        // can't pair with delimiters outside it (length is preserved).
        emStrongMask(src) {
          return src.replace(
            WIKI_ANY_RE,
            (m) => `[${"a".repeat(m.length - 2)}]`,
          );
        },
      },
    });
  }

  return marked;
}

/**
 * Renders Obsidian markdown to (unsanitized) HTML.
 * @param {string} markdown - Source text
 * @param {object} [options]
 * @param {string|null} [options.currentPath] - Tree path of the note being rendered
 *   (the "from" for embeds and the anchor for link resolution)
 * @param {object|null} [options.index] - buildDocsIndex() result
 * @param {number} [options.embedDepth=0] - 0 for the main note; note embeds only expand at 0
 * @param {boolean} [options.allowRawHtml=true] - false escapes raw HTML (Drive files)
 * @param {boolean} [options.wiki=true] - false renders [[...]] as plain text
 * @param {boolean} [options.allowRemoteImages=true] - false turns markdown http(s) images
 *   into links. Raw HTML <img> tags are not affected, so pair it with allowRawHtml:false.
 * @param {string} [options.idPrefix=""] - inserted after "docs-h-" in heading ids and in
 *   same-note heading links ([[#h]], [x](#h)), so several rendered fragments on one page
 *   (embedded notes, canvas text nodes) don't produce duplicate ids. Must match
 *   [a-z0-9-]{0,40} (e.g. "n1-"); anything else is ignored.
 * @returns {string} HTML - pass through sanitizeHtml() before use
 */
export function renderObsidianMarkdown(
  markdown,
  {
    currentPath = null,
    index = null,
    embedDepth = 0,
    allowRawHtml = true,
    wiki = true,
    allowRemoteImages = true,
    idPrefix = "",
  } = {},
) {
  const source = stripFrontmatter(
    typeof markdown === "string" ? markdown : String(markdown ?? ""),
  );
  const ctx = {
    currentPath: currentPath || null,
    index: index || null,
    embedDepth: Number.isFinite(embedDepth) ? embedDepth : 0,
    allowRawHtml: !!allowRawHtml,
    wiki: !!wiki,
    allowRemoteImages: !!allowRemoteImages,
    idPrefix:
      typeof idPrefix === "string" && ID_PREFIX_RE.test(idPrefix)
        ? idPrefix
        : "",
  };

  try {
    return createMarked(ctx).parse(source);
  } catch {
    // marked should never throw, but a render failure must not take the page down
    return `<pre>${escapeHtml(source)}</pre>`;
  }
}

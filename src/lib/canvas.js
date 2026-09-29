/**
 * Obsidian Canvas Module
 * Parses and validates JSON Canvas files (.canvas) and provides the geometry
 * helpers used by the canvas viewer: edge anchors and curves, fit-to-view and
 * zoom-around-a-point.
 *
 * Canvas files are untrusted input: nodes with bad geometry are dropped, colors are
 * validated, and link nodes only keep http(s) URLs.
 */

/** Obsidian's preset colors "1"-"6": red, orange, yellow, green, cyan, purple */
export const CANVAS_PRESET_COLORS = Object.freeze({
  1: "#fb464c",
  2: "#e9973f",
  3: "#e0de71",
  4: "#44cf6e",
  5: "#53dfdd",
  6: "#a882ff",
});

const NODE_TYPES = new Set(["text", "file", "link", "group"]);
const SIDES = new Set(["top", "right", "bottom", "left"]);
const END_TYPES = new Set(["none", "arrow"]);
const COLOR_RE = /^(?:[1-6]|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6})$/;

/**
 * Largest coordinate or size accepted. Real canvases stay within a few hundred
 * thousand px; anything beyond this is garbage that would overflow the bounds math.
 */
const MAX_COORDINATE = 1e8;

/** Unit direction pointing out of each side */
const SIDE_DIRECTIONS = Object.freeze({
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
});

/** Keeps a canvas color only if it's a preset ("1"-"6") or a hex color */
function validColor(color) {
  if (typeof color === "number" && Number.isInteger(color))
    color = String(color);
  return typeof color === "string" && COLOR_RE.test(color) ? color : null;
}

/** Keeps a link node URL only if it is http(s) */
function validLinkUrl(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

/** Optional string field; anything else becomes null */
function optionalString(value) {
  return typeof value === "string" ? value : null;
}

/** Node ids and edge endpoints: non-empty strings, or numbers (stringified) */
function idString(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return typeof value === "string" && value ? value : null;
}

/** A usable coordinate or size: a finite number within MAX_COORDINATE */
function isCoordinate(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_COORDINATE
  );
}

/** Finite number, or the fallback */
function finiteOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Center point of a node */
function center(node) {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

/**
 * Picks facing sides for an edge from the relative node positions:
 * mostly-horizontal pairs connect right/left, mostly-vertical ones bottom/top.
 */
function computeSides(fromNode, toNode) {
  const a = center(fromNode);
  const b = center(toNode);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? ["right", "left"] : ["left", "right"];
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
}

/** Bounding box of all nodes (zero-size box at the origin when empty) */
function computeBounds(nodes) {
  if (nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY,
    maxX,
    maxY,
  };
}

/** Validates and normalizes one node; returns null to drop it */
function cleanNode(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const id = idString(raw.id);
  if (!id) return null;
  if (!NODE_TYPES.has(raw.type)) return null;

  const { x, y, width, height } = raw;
  if (![x, y, width, height].every(isCoordinate)) return null;

  return {
    id,
    type: raw.type,
    x,
    y,
    width: Math.max(0, width),
    height: Math.max(0, height),
    color: validColor(raw.color),
    text: raw.type === "text" && typeof raw.text === "string" ? raw.text : "",
    file: raw.type === "file" ? optionalString(raw.file) : null,
    subpath: raw.type === "file" ? optionalString(raw.subpath) : null,
    url: raw.type === "link" ? validLinkUrl(raw.url) : null,
    label: raw.type === "group" ? optionalString(raw.label) : null,
  };
}

/**
 * Parses a .canvas file.
 * Empty input and "{}" are valid empty canvases, and a leading BOM is ignored.
 * Nodes with non-finite or absurd (beyond +/-1e8) geometry, unknown types or
 * duplicate ids are dropped, as are edges to missing nodes. Edge ids are made unique.
 * Missing edge sides are computed from the node positions; toEnd defaults to
 * "arrow" and fromEnd to "none".
 * @param {string} text - File contents
 * @returns {{ok: true, nodes: object[], edges: object[], bounds: object} |
 *           {ok: false, error: string}}
 */
export function parseCanvas(text) {
  let source = text === null || text === undefined ? "" : String(text);
  if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
  if (source.trim() === "") {
    return { ok: true, nodes: [], edges: [], bounds: computeBounds([]) };
  }

  let data;
  try {
    data = JSON.parse(source);
  } catch {
    return { ok: false, error: "This canvas file is not valid JSON." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "This canvas file has an unexpected format." };
  }

  const nodes = [];
  const nodesById = new Map();
  for (const raw of Array.isArray(data.nodes) ? data.nodes : []) {
    const node = cleanNode(raw);
    if (!node || nodesById.has(node.id)) continue;
    nodes.push(node);
    nodesById.set(node.id, node);
  }

  const edges = [];
  const edgeIds = new Set();
  const rawEdges = Array.isArray(data.edges) ? data.edges : [];
  rawEdges.forEach((raw, i) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const fromId = idString(raw.fromNode);
    const toId = idString(raw.toNode);
    const fromNode = fromId ? nodesById.get(fromId) : null;
    const toNode = toId ? nodesById.get(toId) : null;
    if (!fromNode || !toNode) return;

    const baseId = idString(raw.id) || `edge-${i}`;
    let id = baseId;
    for (let n = 1; edgeIds.has(id); n++) id = `${baseId}-${n}`;
    edgeIds.add(id);

    const [autoFrom, autoTo] = computeSides(fromNode, toNode);
    edges.push({
      id,
      fromNode: fromNode.id,
      toNode: toNode.id,
      fromSide: SIDES.has(raw.fromSide) ? raw.fromSide : autoFrom,
      toSide: SIDES.has(raw.toSide) ? raw.toSide : autoTo,
      fromEnd: END_TYPES.has(raw.fromEnd) ? raw.fromEnd : "none",
      toEnd: END_TYPES.has(raw.toEnd) ? raw.toEnd : "arrow",
      color: validColor(raw.color),
      label: typeof raw.label === "string" && raw.label ? raw.label : null,
    });
  });

  return { ok: true, nodes, edges, bounds: computeBounds(nodes) };
}

/**
 * Converts a canvas color ("1"-"6" preset or hex) to a CSS color.
 * @param {string|null} color - Node or edge color
 * @returns {string|null} CSS color, or null for none/invalid
 */
export function resolveCanvasColor(color) {
  const c = validColor(color);
  if (!c) return null;
  return c.startsWith("#") ? c : CANVAS_PRESET_COLORS[c];
}

/**
 * Point in the middle of a node's side, where edges attach.
 * @param {{x, y, width, height}} node
 * @param {'top'|'right'|'bottom'|'left'} side
 * @returns {{x: number, y: number}}
 */
export function sideAnchor(node, side) {
  switch (side) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
    case "right":
    default:
      return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

/** Rounds to 2 decimals to keep path strings short */
function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Cubic bezier between two node sides, leaving and entering perpendicular to them.
 * @returns {{d: string, labelX: number, labelY: number,
 *            from: {x, y}, to: {x, y}}} SVG path data and the curve midpoint
 */
export function edgePath(fromNode, fromSide, toNode, toSide) {
  const from = sideAnchor(fromNode, fromSide);
  const to = sideAnchor(toNode, toSide);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const offset = Math.min(Math.max(dist * 0.4, 30), 250);

  const d1 = SIDE_DIRECTIONS[fromSide] || SIDE_DIRECTIONS.right;
  const d2 = SIDE_DIRECTIONS[toSide] || SIDE_DIRECTIONS.left;
  const c1 = { x: from.x + d1.x * offset, y: from.y + d1.y * offset };
  const c2 = { x: to.x + d2.x * offset, y: to.y + d2.y * offset };

  // Bezier point at t = 0.5
  const labelX = (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8;
  const labelY = (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8;

  const d =
    `M ${r2(from.x)} ${r2(from.y)} ` +
    `C ${r2(c1.x)} ${r2(c1.y)}, ${r2(c2.x)} ${r2(c2.y)}, ${r2(to.x)} ${r2(to.y)}`;

  return { d, labelX, labelY, from, to };
}

/** Clamps a number into [min, max] */
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

/**
 * View transform that fits the bounds inside a viewport, centered.
 * Screen = world * scale + (x, y). Never zooms in past 100%, and zero-size
 * bounds (an empty canvas or a single point) are clamped to avoid dividing by 0.
 * @param {{x, y, width, height}} bounds - Canvas bounds
 * @param {number} width - Viewport width in px
 * @param {number} height - Viewport height in px
 * @param {number} [padding=40] - Space kept around the content in px
 * @returns {{x: number, y: number, scale: number}}
 */
export function fitView(bounds, width, height, padding = 40) {
  const b = bounds || { x: 0, y: 0, width: 0, height: 0 };
  const boundsW = Math.max(finiteOr(b.width, 0), 0);
  const boundsH = Math.max(finiteOr(b.height, 0), 0);
  const bw = Math.max(boundsW, 1);
  const bh = Math.max(boundsH, 1);
  const vw = Math.max(finiteOr(width, 0), 1);
  const vh = Math.max(finiteOr(height, 0), 1);
  const pad = Math.max(finiteOr(padding, 0), 0);
  const availW = Math.max(vw - 2 * pad, 1);
  const availH = Math.max(vh - 2 * pad, 1);

  const scale = clamp(Math.min(availW / bw, availH / bh), 0.02, 1);
  const cx = finiteOr(b.x, 0) + boundsW / 2;
  const cy = finiteOr(b.y, 0) + boundsH / 2;

  return { x: vw / 2 - cx * scale, y: vh / 2 - cy * scale, scale };
}

/**
 * Zooms by a factor while keeping the world point under (px, py) fixed on screen.
 * @param {{x, y, scale}} view - Current view
 * @param {number} factor - Multiplier (>1 zooms in)
 * @param {number} px - Focal point x, in viewport px
 * @param {number} py - Focal point y, in viewport px
 * @param {number} [minScale=0.05]
 * @param {number} [maxScale=4]
 * @returns {{x: number, y: number, scale: number}}
 */
export function zoomAround(
  view,
  factor,
  px,
  py,
  minScale = 0.05,
  maxScale = 4,
) {
  if (!view || !(view.scale > 0) || !Number.isFinite(view.scale)) return view;
  if (![view.x, view.y, px, py].every(Number.isFinite)) return view;
  const scale = clamp(view.scale * factor, minScale, maxScale);
  if (!Number.isFinite(scale) || scale <= 0) return view;
  const worldX = (px - view.x) / view.scale;
  const worldY = (py - view.y) / view.scale;
  return { x: px - worldX * scale, y: py - worldY * scale, scale };
}

/**
 * Whether two rectangles overlap (touching edges count).
 * @param {{x, y, width, height}} a
 * @param {{x, y, width, height}} b
 * @returns {boolean}
 */
export function rectsIntersect(a, b) {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

/**
 * Whether a pointer event comes from a mouse with no button held.
 * A press released outside the viewport before a drag began (so before pointer
 * capture) never delivers its pointerup to the canvas; a later move over it with
 * no button down means that press is over, not that a pan should start.
 * @param {{pointerType?: string, buttons?: number}} e - Pointer event
 * @returns {boolean}
 */
export function isReleasedMouse(e) {
  return !!e && e.pointerType === "mouse" && e.buttons === 0;
}

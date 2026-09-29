"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FaExpand,
  FaExternalLinkAlt,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaLink,
  FaMinus,
  FaPlus,
  FaProjectDiagram,
  FaQuestion,
} from "react-icons/fa";
import ImageLightbox from "./ImageLightbox";
import {
  parseCanvas,
  resolveCanvasColor,
  edgePath,
  fitView,
  zoomAround,
  rectsIntersect,
  isReleasedMouse,
} from "@/src/lib/canvas";
import { renderObsidianMarkdown, resolveDocLink } from "@/src/lib/obsidian";
import { sanitizeHtml } from "@/src/lib/sanitizeHtml";
import {
  hydrateDocsEmbeds,
  findHeadingForLink,
  nextFragmentIdPrefix,
} from "@/src/lib/docsEmbeds";
import { getFileKind } from "@/src/lib/fileTypes";
import { safeUrl } from "@/src/lib/safeUrl";
import markdownStyles from "./MarkdownBody.module.css";
import embedStyles from "./DocsMarkdownView.module.css";
import styles from "./DocsCanvasView.module.css";

/** Pointer travel (px) before a press becomes a pan, so clicks still work */
const DRAG_THRESHOLD = 4;
const MIN_SCALE = 0.02;
const MAX_SCALE = 4;
/** Zoom step for the +/- buttons and keys */
const BUTTON_ZOOM = 1.25;
/** Arrow-key pan step in px */
const KEY_PAN = 60;
/** Wait this long after the last pan/zoom before checking which nodes are visible */
const SETTLE_MS = 150;
/** Extra area around the viewport (fraction of its size) counted as visible */
const VISIBLE_MARGIN = 0.15;
/** Nodes smaller than this on screen don't load their image / note yet */
const MIN_LOAD_SIZE_PX = 24;
/** Room around the node bounds for edge curves (world px) */
const EDGE_PAD = 300;
/** Grid spacing of the viewport background (px) */
const GRID_SIZE = 24;
const DEFAULT_EDGE_COLOR = "#00d4ff";

const EMPTY_LIST = Object.freeze([]);

/** Last path segment */
function basename(path) {
  const clean = String(path ?? "").replace(/\\/g, "/");
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/** File name without a .md / .canvas extension */
function displayName(path) {
  return basename(path).replace(/\.(md|canvas)$/i, "");
}

/** "#rgb" / "#rgba" / "#rrggbb" -> "rgba(r, g, b, alpha)", or null */
function withAlpha(hex, alpha) {
  let h = String(hex || "").replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Absolute position plus color variables (border, tint, glow) for a node */
function nodeStyle(node) {
  const style = {
    left: node.x,
    top: node.y,
    width: node.width,
    height: node.height,
  };
  const color = resolveCanvasColor(node.color);
  if (color) {
    style["--node-color"] = color;
    const tint = withAlpha(color, 0.14);
    const glow = withAlpha(color, 0.35);
    if (tint) style["--node-tint"] = tint;
    if (glow) style["--node-glow"] = glow;
  }
  return style;
}

/** Whether a press landed on the scrollbar of a node's scroll area */
function isScrollbarHit(target, e) {
  if (!target.hasAttribute("data-canvas-scroll")) return false;
  const rect = target.getBoundingClientRect();
  const scaleX = target.offsetWidth ? rect.width / target.offsetWidth : 1;
  const scaleY = target.offsetHeight ? rect.height / target.offsetHeight : 1;
  const x = (e.clientX - rect.left) / (scaleX || 1);
  const y = (e.clientY - rect.top) / (scaleY || 1);
  return x > target.clientWidth || y > target.clientHeight;
}

/**
 * Scrolls a heading into view inside its node's scroll area (not the canvas),
 * looking it up in the link's own fragment (the node, or an embedded note in it)
 */
function scrollNodeToHeading(anchor, id, scale) {
  const scroller = anchor.closest("[data-canvas-scroll]");
  const heading = findHeadingForLink(scroller, anchor, id);
  if (!heading) return;
  // Screen-space distance, converted back to the node's (unscaled) pixels
  const offset =
    (heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top) /
    (scale || 1);
  const top = scroller.scrollTop + offset - 8;
  if (typeof scroller.scrollTo === "function") {
    scroller.scrollTo({ top, behavior: "smooth" });
  } else {
    scroller.scrollTop = top;
  }
}

/** Icon + name + short note, for nodes that can't show their content */
function Placeholder({ icon, name, note }) {
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.placeholderName}>{name}</span>
      {note && <span className={styles.placeholderNote}>{note}</span>}
    </div>
  );
}

/**
 * Sanitized markdown inside a node, hydrated from the doc's resource cache.
 * Its scroll area is marked data-canvas-scroll so the wheel scrolls it (instead
 * of zooming) whenever the content overflows.
 */
const CanvasMarkdown = memo(function CanvasMarkdown({
  html,
  cache,
  index,
  scrollRootRef,
  className,
}) {
  const ref = useRef(null);
  const indexRef = useRef(index);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !cache) return undefined;
    return hydrateDocsEmbeds(el, cache, {
      index: indexRef.current,
      scrollRoot: scrollRootRef?.current || null,
    });
  }, [html, cache, scrollRootRef]);

  return (
    <div
      ref={ref}
      className={className}
      data-canvas-scroll=""
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

const MARKDOWN_CLASS = `${markdownStyles.markdownBody} ${embedStyles.embedExtras}`;

/** Text node: its markdown, rendered as if it lived in the canvas file */
function TextNodeContent({ node, canvasPath, index, cache, scrollRootRef }) {
  // Own heading ids, so nodes (and the rest of the page) never share one
  const [idPrefix] = useState(nextFragmentIdPrefix);
  const html = useMemo(
    () =>
      sanitizeHtml(
        renderObsidianMarkdown(node.text, { currentPath: canvasPath, index, idPrefix }),
      ),
    [node.text, canvasPath, index, idPrefix],
  );

  return (
    <CanvasMarkdown
      html={html}
      cache={cache}
      index={index}
      scrollRootRef={scrollRootRef}
      className={`${MARKDOWN_CLASS} ${styles.textContent}`}
    />
  );
}

/** Image file node: loads (through the embed endpoint) once it's on screen */
function ImageFileContent({ node, canvasPath, cache, visible }) {
  const name = basename(node.file);
  const [state, setState] = useState({ url: null, failed: false });

  useEffect(() => {
    if (!visible || !cache || !node.file) return undefined;
    let alive = true;
    // Canvas file values are literal names ("#ClairLineArt.jpg" is a real file)
    cache.getEmbedUrl(canvasPath, node.file, { literal: true }).then(
      (url) => {
        if (alive) setState({ url, failed: false });
      },
      (err) => {
        if (alive && err?.name !== "AbortError") {
          setState({ url: null, failed: true });
        }
      },
    );
    // Late results are ignored; the shared fetch belongs to the cache
    return () => {
      alive = false;
    };
  }, [visible, cache, canvasPath, node.file]);

  if (state.failed) {
    return <Placeholder icon={<FaFileImage />} name={name} note="Image not found" />;
  }
  if (!state.url) {
    return (
      <Placeholder
        icon={<FaFileImage />}
        name={name}
        note={visible ? "Loading..." : null}
      />
    );
  }
  return (
    <img
      className={styles.nodeImage}
      src={state.url}
      alt={name}
      decoding="async"
      draggable={false}
      onError={() => setState({ url: null, failed: true })}
    />
  );
}

/** Markdown file node: the note itself, scrollable, with a title that opens it */
function NoteFileContent({ node, canvasPath, index, cache, visible, scrollRootRef }) {
  const name = displayName(node.file);
  const resolved = useMemo(
    () => (node.file ? resolveDocLink(node.file, canvasPath, index) : null),
    [node.file, canvasPath, index],
  );
  const [state, setState] = useState({ path: null, text: null, failed: false });
  const [idPrefix] = useState(nextFragmentIdPrefix);

  useEffect(() => {
    if (!visible || !resolved || !cache) return undefined;
    let alive = true;
    cache.getText(resolved).then(
      (text) => {
        if (alive) setState({ path: resolved, text, failed: false });
      },
      (err) => {
        if (alive && err?.name !== "AbortError") {
          setState({ path: resolved, text: null, failed: true });
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [visible, resolved, cache]);

  const current =
    state.path === resolved ? state : { path: resolved, text: null, failed: false };
  const noteText = current.text;

  const html = useMemo(
    () =>
      noteText === null
        ? ""
        : sanitizeHtml(
            renderObsidianMarkdown(noteText, { currentPath: resolved, index, idPrefix }),
          ),
    [noteText, resolved, index, idPrefix],
  );

  if (!resolved) {
    return <Placeholder icon={<FaFileAlt />} name={name} note="Note not found" />;
  }

  return (
    <>
      <button
        type="button"
        className={styles.nodeHeader}
        data-doc-link={resolved}
        title={`Open ${name}`}
        draggable={false}
      >
        <FaFileAlt aria-hidden="true" className={styles.nodeHeaderIcon} />
        <span className={styles.nodeHeaderText}>{name}</span>
      </button>
      {current.failed ? (
        <div className={styles.nodeStatus}>Could not load this note.</div>
      ) : noteText === null ? (
        <div className={styles.nodeStatus}>{visible ? "Loading..." : ""}</div>
      ) : (
        <CanvasMarkdown
          html={html}
          cache={cache}
          index={index}
          scrollRootRef={scrollRootRef}
          className={`${MARKDOWN_CLASS} ${styles.noteBody}`}
        />
      )}
    </>
  );
}

/** PDF / canvas file node: a card that opens the file */
function FileCardContent({ node, canvasPath, index, kind }) {
  const name = displayName(node.file);
  const Icon = kind === "pdf" ? FaFilePdf : FaProjectDiagram;
  const resolved = useMemo(
    () => (node.file ? resolveDocLink(node.file, canvasPath, index) : null),
    [node.file, canvasPath, index],
  );

  if (!resolved) {
    return (
      <Placeholder icon={<Icon />} name={name} note="Not in the documentation tree" />
    );
  }

  return (
    <button
      type="button"
      className={styles.fileCard}
      data-doc-link={resolved}
      title={`Open ${name}`}
      draggable={false}
    >
      <Icon className={styles.fileCardIcon} aria-hidden="true" />
      <span className={styles.fileCardName}>{name}</span>
      <span className={styles.fileCardHint}>{kind === "pdf" ? "PDF" : "Canvas"}</span>
    </button>
  );
}

/** Link node: a card opening the (http/https) URL in a new tab */
function LinkContent({ node }) {
  const url = node.url ? safeUrl(node.url) : null;
  if (!url) {
    return <Placeholder icon={<FaLink />} name="Link" note="Invalid link" />;
  }

  let host = url;
  try {
    host = new URL(url).host || url;
  } catch {
    // Keep the raw URL
  }

  return (
    <a
      className={styles.linkCard}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      title={url}
    >
      <span className={styles.linkHost}>
        <FaExternalLinkAlt aria-hidden="true" className={styles.linkIcon} />
        {host}
      </span>
      <span className={styles.linkUrl}>{url}</span>
    </a>
  );
}

/** One non-group node, positioned in world coordinates */
const CanvasNode = memo(function CanvasNode({
  node,
  canvasPath,
  index,
  cache,
  visible,
  scrollRootRef,
}) {
  let variant = "";
  let content;

  if (node.type === "text") {
    variant = styles.textNode;
    content = (
      <TextNodeContent
        node={node}
        canvasPath={canvasPath}
        index={index}
        cache={cache}
        scrollRootRef={scrollRootRef}
      />
    );
  } else if (node.type === "link") {
    variant = styles.linkNode;
    content = <LinkContent node={node} />;
  } else {
    const kind = node.file ? getFileKind(node.file) : null;
    if (kind === "image") {
      variant = styles.imageNode;
      content = (
        <ImageFileContent
          node={node}
          canvasPath={canvasPath}
          cache={cache}
          visible={visible}
        />
      );
    } else if (kind === "markdown") {
      variant = styles.noteNode;
      content = (
        <NoteFileContent
          node={node}
          canvasPath={canvasPath}
          index={index}
          cache={cache}
          visible={visible}
          scrollRootRef={scrollRootRef}
        />
      );
    } else if (kind === "pdf" || kind === "canvas") {
      variant = styles.cardNode;
      content = (
        <FileCardContent
          node={node}
          canvasPath={canvasPath}
          index={index}
          kind={kind}
        />
      );
    } else {
      variant = styles.cardNode;
      content = (
        <Placeholder
          icon={<FaQuestion />}
          name={displayName(node.file) || "File"}
          note="Unsupported file"
        />
      );
    }
  }

  return (
    <div className={`${styles.node} ${variant}`} style={nodeStyle(node)}>
      {content}
    </div>
  );
});

/** Group boxes (tinted, labelled); drawn below edges and nodes */
const CanvasGroups = memo(function CanvasGroups({ groups }) {
  return groups.map((group) => (
    <div key={group.id} className={styles.group} style={nodeStyle(group)}>
      {group.label && <div className={styles.groupLabel}>{group.label}</div>}
    </div>
  ));
});

/**
 * Edge layer: one SVG in world coordinates. Each distinct edge color gets its
 * own arrow marker (ids from useId + palette index, so several canvases on a
 * page never collide); "auto-start-reverse" lets the same marker serve fromEnd.
 */
const CanvasEdges = memo(function CanvasEdges({ edges, nodesById, bounds, markerBase }) {
  const { palette, items } = useMemo(() => {
    const colors = [];
    const list = [];
    for (const edge of edges) {
      const from = nodesById.get(edge.fromNode);
      const to = nodesById.get(edge.toNode);
      if (!from || !to) continue;
      const color = resolveCanvasColor(edge.color) || DEFAULT_EDGE_COLOR;
      let colorIndex = colors.indexOf(color);
      if (colorIndex === -1) {
        colorIndex = colors.length;
        colors.push(color);
      }
      const { d, labelX, labelY } = edgePath(from, edge.fromSide, to, edge.toSide);
      list.push({ edge, color, colorIndex, d, labelX, labelY });
    }
    return { palette: colors, items: list };
  }, [edges, nodesById]);

  if (items.length === 0) return null;

  const x = bounds.minX - EDGE_PAD;
  const y = bounds.minY - EDGE_PAD;
  const width = bounds.width + EDGE_PAD * 2;
  const height = bounds.height + EDGE_PAD * 2;

  return (
    <svg
      className={styles.edges}
      style={{ left: x, top: y, width, height }}
      viewBox={`${x} ${y} ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {palette.map((color, i) => (
          <marker
            key={color}
            id={`${markerBase}-arrow-${i}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
      </defs>
      {items.map(({ edge, color, colorIndex, d, labelX, labelY }) => {
        const marker = `url(#${markerBase}-arrow-${colorIndex})`;
        return (
          <g key={edge.id}>
            <path
              className={styles.edgePath}
              d={d}
              stroke={color}
              markerStart={edge.fromEnd === "arrow" ? marker : undefined}
              markerEnd={edge.toEnd === "arrow" ? marker : undefined}
            />
            {edge.label && (
              <text
                className={styles.edgeLabel}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
});

/**
 * DocsCanvasView - Pan/zoom viewer for Obsidian .canvas files.
 *
 * The viewport clips a "world" layer moved with translate()/scale(), updated
 * directly on the DOM (once per animation frame) so panning never re-renders
 * React. Layers from bottom to top: groups, the SVG edge layer, then nodes.
 *
 * Interaction: drag to pan (after a 4px threshold, so clicks still work), wheel
 * zooms around the cursor (except over a node whose content scrolls), two
 * fingers pinch-zoom, +/-/Fit buttons and arrow/+/-/0 keys. Images and notes
 * in file nodes load once the node is on screen, checked when pan/zoom settles.
 *
 * @param {string} path - Tree path of the canvas file
 * @param {string} text - Canvas JSON
 * @param {object} index - buildDocsIndex() result
 * @param {object} cache - createDocsResourceCache() result for this doc
 * @param {function} onSelectFile - Navigate to another doc by tree path
 */
export default function DocsCanvasView({ path, text, index, cache, onSelectFile }) {
  const parsed = useMemo(() => parseCanvas(text), [text]);
  const nodes = parsed.ok ? parsed.nodes : EMPTY_LIST;
  const edges = parsed.ok ? parsed.edges : EMPTY_LIST;
  const bounds = parsed.ok ? parsed.bounds : null;

  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const groups = useMemo(() => nodes.filter((n) => n.type === "group"), [nodes]);
  const items = useMemo(() => nodes.filter((n) => n.type !== "group"), [nodes]);
  const lazyNodes = useMemo(() => nodes.filter((n) => n.type === "file"), [nodes]);

  const markerBase = `cv-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const frameRef = useRef(0);
  const settleTimerRef = useRef(0);
  const suppressTimerRef = useRef(0);
  const userMovedRef = useRef(false);
  const pointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const suppressClickRef = useRef(false);

  const [visibleIds, setVisibleIds] = useState(() => new Set());
  const [lightbox, setLightbox] = useState(null);

  /** Writes the current view to the world layer (and moves the grid) */
  const writeTransform = useCallback(() => {
    const { x, y, scale } = viewRef.current;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
    if (viewportRef.current) {
      viewportRef.current.style.backgroundPosition = `${x % GRID_SIZE}px ${y % GRID_SIZE}px`;
    }
  }, []);

  /** Marks file nodes that are (nearly) on screen and big enough to load */
  const computeVisible = useCallback(() => {
    const el = viewportRef.current;
    if (!el || lazyNodes.length === 0) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;

    const { x, y, scale } = viewRef.current;
    const worldW = w / scale;
    const worldH = h / scale;
    const area = {
      x: -x / scale - worldW * VISIBLE_MARGIN,
      y: -y / scale - worldH * VISIBLE_MARGIN,
      width: worldW * (1 + 2 * VISIBLE_MARGIN),
      height: worldH * (1 + 2 * VISIBLE_MARGIN),
    };

    setVisibleIds((prev) => {
      let next = null;
      for (const node of lazyNodes) {
        if (prev.has(node.id)) continue;
        if (Math.max(node.width, node.height) * scale < MIN_LOAD_SIZE_PX) continue;
        if (!rectsIntersect(area, node)) continue;
        if (!next) next = new Set(prev);
        next.add(node.id);
      }
      return next || prev;
    });
  }, [lazyNodes]);

  const scheduleSettle = useCallback(() => {
    clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(computeVisible, SETTLE_MS);
  }, [computeVisible]);

  /** Sets the view; the DOM is updated on the next frame (or now, if immediate) */
  const applyView = useCallback(
    (next, immediate = false) => {
      if (
        !next ||
        !Number.isFinite(next.x) ||
        !Number.isFinite(next.y) ||
        !Number.isFinite(next.scale) ||
        next.scale <= 0
      ) {
        return;
      }
      viewRef.current = next;
      if (immediate) {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        writeTransform();
      } else if (!frameRef.current) {
        frameRef.current = requestAnimationFrame(() => {
          frameRef.current = 0;
          writeTransform();
        });
      }
      scheduleSettle();
    },
    [writeTransform, scheduleSettle],
  );

  /** Fits the whole canvas into the viewport */
  const fitNow = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    const padding = Math.min(40, Math.min(w, h) / 10);
    applyView(fitView(bounds, w, h, padding), true);
  }, [bounds, applyView]);

  /** Zooms around the viewport center */
  const zoomBy = useCallback(
    (factor) => {
      const el = viewportRef.current;
      if (!el) return;
      userMovedRef.current = true;
      applyView(
        zoomAround(
          viewRef.current,
          factor,
          el.clientWidth / 2,
          el.clientHeight / 2,
          MIN_SCALE,
          MAX_SCALE,
        ),
      );
    },
    [applyView],
  );

  const handleFit = useCallback(() => {
    userMovedRef.current = false;
    fitNow();
  }, [fitNow]);

  // Initial fit before paint (and again if the canvas changes while untouched)
  useLayoutEffect(() => {
    if (userMovedRef.current) return;
    fitNow();
    computeVisible();
  }, [fitNow, computeVisible]);

  // Refit on resize until the user has moved the view
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (!userMovedRef.current) fitNow();
      else scheduleSettle();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitNow, scheduleSettle]);

  // Cancel pending frame/timers on unmount (refs reset for StrictMode remounts)
  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      clearTimeout(settleTimerRef.current);
      clearTimeout(suppressTimerRef.current);
      suppressClickRef.current = false;
      pointersRef.current.clear();
      gestureRef.current = null;
    },
    [],
  );

  // Wheel: zoom around the cursor (non-passive so the page doesn't scroll)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const scroller = target ? target.closest("[data-canvas-scroll]") : null;
      if (
        scroller &&
        el.contains(scroller) &&
        scroller.scrollHeight > scroller.clientHeight + 1
      ) {
        return; // Let the node's content scroll
      }

      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height || 800 : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      userMovedRef.current = true;

      // Horizontal scrolling (trackpads, shift+wheel) pans sideways
      if (!e.ctrlKey && Math.abs(dx) > Math.abs(dy)) {
        const v = viewRef.current;
        applyView({ ...v, x: v.x - dx });
        return;
      }

      const clamped = Math.max(-300, Math.min(300, dy));
      // Trackpad pinch arrives as ctrl+wheel with small deltas
      const factor = Math.exp(-clamped * (e.ctrlKey ? 0.01 : 0.0015));
      applyView(
        zoomAround(
          viewRef.current,
          factor,
          e.clientX - rect.left,
          e.clientY - rect.top,
          MIN_SCALE,
          MAX_SCALE,
        ),
      );
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [applyView]);

  // Focusing a node's button can scroll the clipped viewport itself, which would
  // shift everything out from under the transform; keep it pinned at 0,0.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      if (el.scrollTop !== 0 || el.scrollLeft !== 0) {
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Swallow the click that ends a drag (capture phase, before React's handlers)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onClickCapture = (e) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("click", onClickCapture, true);
    return () => el.removeEventListener("click", onClickCapture, true);
  }, []);

  /** Pointer position relative to the viewport */
  const toLocal = useCallback((e) => {
    const rect = viewportRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  /** (Re)starts a pinch from the first two active pointers */
  const beginPinch = useCallback(() => {
    const [a, b] = Array.from(pointersRef.current.values());
    if (!a || !b) return;
    gestureRef.current = {
      type: "pinch",
      startDist: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      startView: viewRef.current,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (!viewportRef.current) return;
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target && target.closest("[data-canvas-controls]")) return;
      if (target && isScrollbarHit(target, e)) return;

      // A new gesture: forget pointers whose "up" we never saw
      if (e.isPrimary) {
        pointersRef.current.clear();
        gestureRef.current = null;
      }
      suppressClickRef.current = false;

      const p = toLocal(e);
      pointersRef.current.set(e.pointerId, p);
      if (pointersRef.current.size >= 2) {
        beginPinch();
      } else {
        gestureRef.current = {
          type: "pending",
          pointerId: e.pointerId,
          start: p,
          startView: viewRef.current,
        };
      }
      if (e.button === 1) e.preventDefault(); // No middle-click autoscroll
    },
    [toLocal, beginPinch],
  );

  const handlePointerEnd = useCallback(
    (e) => {
      const pointers = pointersRef.current;
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);

      const gesture = gestureRef.current;
      const moved = gesture && (gesture.type === "pan" || gesture.type === "pinch");
      if (moved && e.type === "pointerup") {
        // The click that follows this pointerup must not open/navigate anything
        suppressClickRef.current = true;
        clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      const el = viewportRef.current;
      try {
        if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {
        // Already released
      }

      if (pointers.size === 0) {
        gestureRef.current = null;
        if (el) el.classList.remove(styles.panning);
      } else if (pointers.size === 1) {
        // Lifting one finger of a pinch keeps panning with the other
        const [[pointerId, p]] = Array.from(pointers.entries());
        gestureRef.current = {
          type: moved ? "pan" : "pending",
          pointerId,
          start: p,
          startView: viewRef.current,
        };
      } else {
        beginPinch();
      }
    },
    [beginPinch],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const pointers = pointersRef.current;
      if (!pointers.has(e.pointerId)) return;
      // A press released off the viewport before the drag threshold (no capture
      // yet) never sent us its pointerup: end it instead of panning on hover
      if (isReleasedMouse(e)) {
        handlePointerEnd(e);
        return;
      }
      const p = toLocal(e);
      pointers.set(e.pointerId, p);

      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.type === "pinch") {
        const [a, b] = Array.from(pointers.values());
        if (!a || !b) return;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoomed = zoomAround(
          gesture.startView,
          dist / gesture.startDist,
          gesture.startMid.x,
          gesture.startMid.y,
          MIN_SCALE,
          MAX_SCALE,
        );
        userMovedRef.current = true;
        applyView({
          x: zoomed.x + (mid.x - gesture.startMid.x),
          y: zoomed.y + (mid.y - gesture.startMid.y),
          scale: zoomed.scale,
        });
        return;
      }

      if (gesture.pointerId !== e.pointerId) return;
      const dx = p.x - gesture.start.x;
      const dy = p.y - gesture.start.y;

      if (gesture.type === "pending") {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        gesture.type = "pan";
        const el = viewportRef.current;
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Pointer already gone
        }
        el.classList.add(styles.panning);
      }

      userMovedRef.current = true;
      applyView({
        x: gesture.startView.x + dx,
        y: gesture.startView.y + dy,
        scale: gesture.startView.scale,
      });
    },
    [toLocal, applyView, handlePointerEnd],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.target !== viewportRef.current) return;
      const v = viewRef.current;
      const pan = (dx, dy) => {
        userMovedRef.current = true;
        applyView({ ...v, x: v.x + dx, y: v.y + dy });
      };
      switch (e.key) {
        case "ArrowLeft":
          pan(KEY_PAN, 0);
          break;
        case "ArrowRight":
          pan(-KEY_PAN, 0);
          break;
        case "ArrowUp":
          pan(0, KEY_PAN);
          break;
        case "ArrowDown":
          pan(0, -KEY_PAN);
          break;
        case "+":
        case "=":
          zoomBy(BUTTON_ZOOM);
          break;
        case "-":
        case "_":
          zoomBy(1 / BUTTON_ZOOM);
          break;
        case "0":
          handleFit();
          break;
        default:
          return;
      }
      e.preventDefault();
    },
    [applyView, zoomBy, handleFit],
  );

  // Delegated clicks: doc links, heading anchors, images -> lightbox
  const handleClick = useCallback(
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const docLink = target.closest("[data-doc-link]");
      if (docLink) {
        e.preventDefault();
        const docPath = docLink.getAttribute("data-doc-link");
        if (docPath && onSelectFile) onSelectFile(docPath);
        return;
      }

      const anchor = target.closest("a[href^='#']");
      if (anchor) {
        e.preventDefault();
        const href = anchor.getAttribute("href") || "";
        if (href.startsWith("#docs-h-")) {
          scrollNodeToHeading(anchor, href.slice(1), viewRef.current.scale);
        }
        return;
      }

      const img = target.closest("img");
      if (img && img.getAttribute("src") && !img.closest("a")) {
        setLightbox({ url: img.getAttribute("src"), alt: img.getAttribute("alt") || "" });
      }
    },
    [onSelectFile],
  );

  const preventNativeDrag = useCallback((e) => e.preventDefault(), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const canvasName = displayName(path);

  return (
    <div className={styles.canvasView}>
      <div
        ref={viewportRef}
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-roledescription="canvas"
        aria-label={`${canvasName} canvas. Drag to pan, scroll or pinch to zoom.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onDragStart={preventNativeDrag}
      >
        <div ref={worldRef} className={styles.world}>
          <CanvasGroups groups={groups} />
          {bounds && (
            <CanvasEdges
              edges={edges}
              nodesById={nodesById}
              bounds={bounds}
              markerBase={markerBase}
            />
          )}
          {items.map((node) => (
            <CanvasNode
              key={node.id}
              node={node}
              canvasPath={path}
              index={index}
              cache={cache}
              visible={node.type === "file" ? visibleIds.has(node.id) : true}
              scrollRootRef={viewportRef}
            />
          ))}
        </div>

        {!parsed.ok && (
          <div className={styles.message}>
            <p className={styles.messageTitle}>CANVAS UNREADABLE</p>
            <p className={styles.messageText}>{parsed.error}</p>
          </div>
        )}
        {parsed.ok && nodes.length === 0 && (
          <div className={styles.message}>
            <p className={styles.messageTitle}>EMPTY CANVAS</p>
            <p className={styles.messageText}>This canvas is empty</p>
          </div>
        )}

        <div
          className={styles.controls}
          data-canvas-controls=""
          role="toolbar"
          aria-label="Canvas zoom"
        >
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => zoomBy(BUTTON_ZOOM)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <FaPlus aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => zoomBy(1 / BUTTON_ZOOM)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <FaMinus aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.controlButton}
            onClick={handleFit}
            aria-label="Fit canvas to view"
            title="Fit to view"
          >
            <FaExpand aria-hidden="true" />
            <span>FIT</span>
          </button>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox url={lightbox.url} alt={lightbox.alt} onClose={closeLightbox} />
      )}
    </div>
  );
}

/**
 * In-page PDF rendering with pdf.js, for browsers that can't show a PDF in an
 * iframe (most phones and tablets). pdf.js is imported on first use, so desktop
 * browsers that keep the built-in viewer never download it.
 *
 * Pages are drawn as canvases only: no text layer, links, forms or scripts.
 * A page renders when it nears the visible area and is released again when it
 * scrolls far away, so memory stays flat on long documents.
 */

/** Pages within this margin of the scroll box are rendered */
const RENDER_MARGIN = "150% 0px";

/** Cap per page canvas, well under iOS Safari's 16.7M-pixel canvas limit */
const MAX_CANVAS_PIXELS = 8_000_000;

/** Highest device pixel ratio used for rendering */
const MAX_OUTPUT_SCALE = 3;

/** How long the worker may take to start before falling back to the main thread */
const WORKER_START_TIMEOUT_MS = 15_000;

/** Re-render delay after the scroll box changes width */
const RESIZE_DEBOUNCE_MS = 150;

/** Zoom steps offered by viewers (1 = page fits the width) */
export const PDF_ZOOM_STEPS = [1, 1.5, 2, 3];

const MIN_ZOOM = PDF_ZOOM_STEPS[0];
const MAX_ZOOM = PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1];

/**
 * Whether the browser should show PDFs in an iframe with its built-in viewer.
 * False when the browser says it has no viewer (navigator.pdfViewerEnabled ===
 * false, as on Android) and on touch-only devices, whose inline viewers show
 * one page or can't scroll inside a frame. Window size plays no part, so a
 * narrow desktop window keeps the built-in viewer.
 * @returns {boolean}
 */
export function hasInlinePdfViewer() {
  try {
    if (typeof navigator !== "undefined" && navigator.pdfViewerEnabled === false) {
      return false;
    }
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches
    ) {
      return false;
    }
  } catch {
    // Fall through: assume a desktop browser
  }
  return true;
}

let enginePromise = null;

/**
 * Loads pdf.js and one shared PDFWorker, once.
 * The worker runs pdf.js's parser off the main thread; when it can't start
 * (no module workers, or the server refuses the worker file) parsing falls
 * back to the main thread, which is slower but works everywhere.
 * @returns {Promise<{pdfjs: object, worker: object}>}
 */
export function loadPdfEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const port = globalThis.pdfjsWorker ? null : await startWorker();
      if (!port && !globalThis.pdfjsWorker) {
        // Sets globalThis.pdfjsWorker, which makes pdf.js parse on this thread
        await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      }
      // One explicit worker shared by every document: pdf.js never destroys a
      // worker it was given, so closing one PDF can't break another
      const worker = port
        ? new pdfjs.PDFWorker({ port })
        : new pdfjs.PDFWorker();
      return { pdfjs, worker };
    })().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

/** Starts the pdf.js worker; resolves null when it can't load */
function startWorker() {
  if (typeof Worker !== "function") return Promise.resolve(null);
  let worker;
  try {
    worker = new Worker(
      new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" },
    );
  } catch {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let timer = null;
    const finish = (ok) => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      clearTimeout(timer);
      if (ok) {
        resolve(worker);
      } else {
        worker.terminate();
        resolve(null);
      }
    };
    // The worker posts "ready" as soon as its script has run
    const onMessage = () => finish(true);
    const onError = () => finish(false);
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    timer = setTimeout(() => finish(false), WORKER_START_TIMEOUT_MS);
  });
}

/** Reads the PDF bytes from a Blob, an ArrayBuffer or typed array, or a (blob:) URL */
async function toBytes(source) {
  if (source instanceof Uint8Array) return source;
  if (source instanceof ArrayBuffer) return new Uint8Array(source);
  if (typeof source === "string") {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  if (source && typeof source.arrayBuffer === "function") {
    return new Uint8Array(await source.arrayBuffer());
  }
  throw new Error("No PDF data");
}

/** Clamps a zoom factor to the supported range */
export function clampZoom(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * Render scale for a page drawn `cssWidth` CSS pixels wide: sharp on high-DPI
 * screens, but never over MAX_CANVAS_PIXELS.
 * @param {{width: number, height: number}} base - Page size at scale 1
 * @param {number} cssWidth - Width the page is shown at
 * @param {number} dpr - Device pixel ratio
 * @returns {number}
 */
export function renderScale(base, cssWidth, dpr) {
  if (!base || !(base.width > 0) || !(base.height > 0) || !(cssWidth > 0)) {
    return 0;
  }
  const ratio = Math.min(Math.max(Number(dpr) || 1, 1), MAX_OUTPUT_SCALE);
  let scale = (cssWidth / base.width) * ratio;
  const pixels = base.width * base.height * scale * scale;
  if (pixels > MAX_CANVAS_PIXELS) {
    scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
  }
  return scale;
}

/**
 * Shows every page of a PDF as canvases inside `container`, which should be a
 * scroll box (overflow: auto) with a fixed height. Its children are replaced.
 *
 * @param {HTMLElement} container - Scroll box; its width sets the page width
 * @param {Blob|ArrayBuffer|Uint8Array|string} source - PDF bytes or a blob: URL
 * @param {object} [options]
 * @param {(state: {status: "loading"|"ready"|"error", pages?: number, error?: Error}) => void} [options.onStatus]
 * @param {number} [options.zoom=1] - Page width as a multiple of the box width
 * @param {Function} [options.loadEngine] - Test seam for loadPdfEngine
 * @returns {{setZoom: (zoom: number) => void, destroy: () => void}}
 */
export function mountPdfPages(container, source, options = {}) {
  const { onStatus = () => {}, loadEngine = loadPdfEngine } = options;
  const doc = container.ownerDocument;
  const win = doc.defaultView || globalThis;

  let zoom = clampZoom(options.zoom ?? 1);
  let destroyed = false;
  let loadingTask = null;
  let pdf = null;
  let resizeTimer = null;
  let lastWidth = container.clientWidth;
  const entries = [];
  const near = new Set();

  const list = doc.createElement("div");
  list.className = "pdf-canvas-pages";
  Object.assign(list.style, {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: "8px",
    boxSizing: "border-box",
    padding: "8px",
    width: `${zoom * 100}%`,
    minWidth: "100%",
  });
  container.replaceChildren(list);

  const report = (state) => {
    if (!destroyed) {
      try {
        onStatus(state);
      } catch {
        // A failing listener must not break rendering
      }
    }
  };

  let observer = null;
  if (typeof win.IntersectionObserver === "function") {
    try {
      observer = new win.IntersectionObserver(
        (records) => {
          for (const record of records) {
            const entry = record.target.__pdfEntry;
            if (!entry) continue;
            if (record.isIntersecting) {
              near.add(entry);
              renderPage(entry);
            } else {
              near.delete(entry);
              releasePage(entry);
            }
          }
        },
        { root: container, rootMargin: RENDER_MARGIN },
      );
    } catch {
      observer = null;
    }
  }

  let resizeObserver = null;
  if (typeof win.ResizeObserver === "function") {
    resizeObserver = new win.ResizeObserver(() => {
      const width = container.clientWidth;
      if (Math.abs(width - lastWidth) < 2) return;
      lastWidth = width;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rerenderNear, RESIZE_DEBOUNCE_MS);
    });
    resizeObserver.observe(container);
  }

  function rerenderNear() {
    if (destroyed) return;
    for (const entry of near) renderPage(entry);
  }

  /** Draws a page at its current width; the old canvas stays until the new one is ready */
  function renderPage(entry) {
    if (destroyed) return;
    const base = entry.page.getViewport({ scale: 1 });
    const scale = renderScale(base, entry.el.clientWidth, win.devicePixelRatio);
    if (!scale) return;
    if (entry.canvas && Math.abs(entry.scale - scale) < 0.01) return;
    if (entry.task && Math.abs(entry.pendingScale - scale) < 0.01) return;
    if (entry.task) entry.task.cancel();

    const viewport = entry.page.getViewport({ scale });
    const canvas = doc.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });

    const task = entry.page.render({ canvas, viewport });
    entry.task = task;
    entry.pendingScale = scale;
    task.promise.then(
      () => {
        if (entry.task !== task) return;
        entry.task = null;
        if (destroyed) return;
        freeCanvas(entry.canvas);
        entry.canvas = canvas;
        entry.scale = scale;
        entry.el.replaceChildren(canvas);
      },
      (err) => {
        if (entry.task === task) entry.task = null;
        freeCanvas(canvas);
        if (err && err.name === "RenderingCancelledException") return;
        if (!destroyed && !entry.canvas) {
          entry.el.textContent = `Page ${entry.number} could not be displayed`;
        }
      },
    );
  }

  /** Drops a page's canvas (and pending render) to free memory */
  function releasePage(entry) {
    if (entry.task) {
      entry.task.cancel();
      entry.task = null;
    }
    if (entry.canvas) {
      freeCanvas(entry.canvas);
      entry.canvas = null;
      entry.scale = 0;
      entry.el.replaceChildren();
    }
  }

  function freeCanvas(canvas) {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
  }

  (async () => {
    try {
      report({ status: "loading" });
      const { pdfjs, worker } = await loadEngine();
      if (destroyed) return;
      const data = await toBytes(source);
      if (destroyed) return;
      loadingTask = pdfjs.getDocument({ data, worker, enableXfa: false });
      pdf = await loadingTask.promise;
      if (destroyed) return;

      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        if (destroyed) return;
        const base = page.getViewport({ scale: 1 });
        const el = doc.createElement("div");
        el.className = "pdf-canvas-page";
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", `Page ${n} of ${pdf.numPages}`);
        Object.assign(el.style, {
          position: "relative",
          width: "100%",
          aspectRatio: `${base.width} / ${base.height}`,
          flex: "none",
          overflow: "hidden",
          background: "#fff",
          color: "#333",
        });
        const entry = { number: n, el, page, canvas: null, scale: 0, task: null, pendingScale: 0 };
        el.__pdfEntry = entry;
        entries.push(entry);
        list.appendChild(el);
        if (observer) {
          observer.observe(el);
        } else {
          near.add(entry);
          renderPage(entry);
        }
        if (n === 1) report({ status: "ready", pages: pdf.numPages });
      }
      if (pdf.numPages === 0) report({ status: "ready", pages: 0 });
    } catch (error) {
      report({ status: "error", error });
    }
  })();

  return {
    /** Sets the page width to `value` times the box width, keeping the scroll position */
    setZoom(value) {
      const next = clampZoom(value);
      if (destroyed || next === zoom) return;
      const height = container.scrollHeight || 1;
      const ratio = container.scrollTop / height;
      zoom = next;
      list.style.width = `${zoom * 100}%`;
      container.scrollTop = ratio * container.scrollHeight;
      rerenderNear();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(resizeTimer);
      if (observer) observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      for (const entry of entries) {
        releasePage(entry);
        delete entry.el.__pdfEntry;
      }
      near.clear();
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      } else if (pdf) {
        pdf.destroy().catch(() => {});
      }
      container.replaceChildren();
    },
  };
}

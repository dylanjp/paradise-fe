/**
 * Tests for the pdf.js page renderer used where the browser has no inline PDF
 * viewer. pdf.js itself is replaced by a fake engine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clampZoom,
  hasInlinePdfViewer,
  mountPdfPages,
  renderScale,
  PDF_ZOOM_STEPS,
} from "../pdfCanvas";

/** Waits for queued promise callbacks */
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** A fake pdf.js with pages of the given sizes */
function fakeEngine(sizes, { fail = null } = {}) {
  const renders = [];
  const pages = sizes.map(([width, height], i) => ({
    number: i + 1,
    getViewport: ({ scale }) => ({ width: width * scale, height: height * scale, scale }),
    render: vi.fn(({ canvas, viewport }) => {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const task = {
        page: i + 1,
        canvas,
        viewport,
        promise,
        resolve,
        cancel: vi.fn(() => {
          const err = new Error("cancelled");
          err.name = "RenderingCancelledException";
          reject(err);
        }),
      };
      renders.push(task);
      return task;
    }),
  }));
  const pdf = {
    numPages: pages.length,
    getPage: vi.fn(async (n) => pages[n - 1]),
    destroy: vi.fn(async () => {}),
  };
  const loadingTask = {
    promise: fail ? Promise.reject(fail) : Promise.resolve(pdf),
    destroy: vi.fn(async () => {}),
  };
  const worker = { name: "shared-worker" };
  const pdfjs = { getDocument: vi.fn(() => loadingTask) };
  return {
    pdfjs,
    worker,
    pdf,
    pages,
    renders,
    loadingTask,
    loadEngine: vi.fn(async () => ({ pdfjs, worker })),
  };
}

describe("hasInlinePdfViewer", () => {
  let origMatchMedia;
  let origPdfViewer;

  beforeEach(() => {
    origMatchMedia = window.matchMedia;
    origPdfViewer = Object.getOwnPropertyDescriptor(navigator, "pdfViewerEnabled");
  });

  afterEach(() => {
    window.matchMedia = origMatchMedia;
    if (origPdfViewer) {
      Object.defineProperty(navigator, "pdfViewerEnabled", origPdfViewer);
    } else {
      delete navigator.pdfViewerEnabled;
    }
  });

  const setPdfViewer = (value) =>
    Object.defineProperty(navigator, "pdfViewerEnabled", { value, configurable: true });

  it("is true on a desktop browser, whatever the window size", () => {
    setPdfViewer(true);
    window.matchMedia = () => ({ matches: false });
    expect(hasInlinePdfViewer()).toBe(true);
  });

  it("is true when the browser predates pdfViewerEnabled", () => {
    setPdfViewer(undefined);
    window.matchMedia = undefined;
    expect(hasInlinePdfViewer()).toBe(true);
  });

  it("is false when the browser reports no PDF viewer (Android)", () => {
    setPdfViewer(false);
    window.matchMedia = () => ({ matches: false });
    expect(hasInlinePdfViewer()).toBe(false);
  });

  it("is false on touch-only devices even when a viewer is reported (iOS)", () => {
    setPdfViewer(true);
    window.matchMedia = (q) => ({
      matches: q === "(hover: none) and (pointer: coarse)",
    });
    expect(hasInlinePdfViewer()).toBe(false);
  });
});

describe("renderScale", () => {
  it("fits the width and multiplies by the device pixel ratio", () => {
    expect(renderScale({ width: 600, height: 800 }, 300, 1)).toBeCloseTo(0.5);
    expect(renderScale({ width: 600, height: 800 }, 300, 2)).toBeCloseTo(1);
  });

  it("caps the ratio at 3 and treats a missing ratio as 1", () => {
    expect(renderScale({ width: 100, height: 100 }, 100, 5)).toBeCloseTo(3);
    expect(renderScale({ width: 100, height: 100 }, 100, undefined)).toBeCloseTo(1);
  });

  it("never produces a canvas over 8 million pixels", () => {
    const base = { width: 612, height: 792 };
    const scale = renderScale(base, 2400, 3);
    expect(base.width * scale * base.height * scale).toBeLessThanOrEqual(8_000_001);
  });

  it("is 0 for an unmeasurable page or box", () => {
    expect(renderScale({ width: 600, height: 800 }, 0, 2)).toBe(0);
    expect(renderScale({ width: 0, height: 800 }, 300, 2)).toBe(0);
    expect(renderScale(null, 300, 2)).toBe(0);
  });
});

describe("clampZoom", () => {
  it("keeps zoom within the offered steps", () => {
    expect(clampZoom(0.2)).toBe(PDF_ZOOM_STEPS[0]);
    expect(clampZoom(99)).toBe(PDF_ZOOM_STEPS[PDF_ZOOM_STEPS.length - 1]);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom("nope")).toBe(PDF_ZOOM_STEPS[0]);
  });
});

describe("mountPdfPages", () => {
  let widthSpy;
  let container;

  beforeEach(() => {
    // jsdom has no layout: the box is 300px wide and pages follow the zoomed list width
    widthSpy = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockImplementation(function clientWidth() {
        if (this.classList && this.classList.contains("pdf-canvas-page")) {
          const percent = parseFloat(this.parentElement?.style.width) || 100;
          return (300 * percent) / 100;
        }
        return 300;
      });
    window.devicePixelRatio = 2;
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    widthSpy.mockRestore();
    container.remove();
  });

  it("opens the bytes with the shared worker and lays out one placeholder per page", async () => {
    const engine = fakeEngine([
      [600, 800],
      [800, 600],
    ]);
    const states = [];
    const bytes = new Uint8Array([37, 80, 68, 70]);

    mountPdfPages(container, bytes, {
      loadEngine: engine.loadEngine,
      onStatus: (s) => states.push(s),
    });
    await flush();

    expect(engine.pdfjs.getDocument).toHaveBeenCalledTimes(1);
    const params = engine.pdfjs.getDocument.mock.calls[0][0];
    expect(params.data).toBe(bytes);
    expect(params.worker).toBe(engine.worker);
    expect(params.enableXfa).toBe(false);

    const pages = container.querySelectorAll(".pdf-canvas-page");
    expect(pages).toHaveLength(2);
    expect(pages[0].getAttribute("aria-label")).toBe("Page 1 of 2");
    expect(pages[1].getAttribute("aria-label")).toBe("Page 2 of 2");
    expect(states.map((s) => s.status)).toEqual(["loading", "ready"]);
    expect(states[1].pages).toBe(2);
  });

  it("renders each page at the box width times the pixel ratio and swaps the canvas in when done", async () => {
    const engine = fakeEngine([[600, 800]]);
    mountPdfPages(container, new Uint8Array([1]), { loadEngine: engine.loadEngine });
    await flush();

    expect(engine.renders).toHaveLength(1);
    const task = engine.renders[0];
    // 300px wide at ratio 2 = 600 device pixels
    expect(task.canvas.width).toBe(600);
    expect(task.canvas.height).toBe(800);
    expect(container.querySelector("canvas")).toBeNull();

    task.resolve();
    await flush();
    expect(container.querySelector(".pdf-canvas-page canvas")).toBe(task.canvas);
  });

  it("re-renders sharper pages when zoomed, keeping the old canvas until then", async () => {
    const engine = fakeEngine([[600, 800]]);
    const view = mountPdfPages(container, new Uint8Array([1]), { loadEngine: engine.loadEngine });
    await flush();
    engine.renders[0].resolve();
    await flush();
    const first = engine.renders[0].canvas;

    view.setZoom(2);
    expect(container.querySelector(".pdf-canvas-pages").style.width).toBe("200%");
    expect(engine.renders).toHaveLength(2);
    expect(container.querySelector("canvas")).toBe(first);

    engine.renders[1].resolve();
    await flush();
    expect(container.querySelector("canvas")).toBe(engine.renders[1].canvas);
    expect(first.width).toBe(0);
  });

  it("reports a password-protected or broken PDF as an error", async () => {
    const err = new Error("No password given");
    err.name = "PasswordException";
    const engine = fakeEngine([], { fail: err });
    const states = [];
    mountPdfPages(container, new Uint8Array([1]), {
      loadEngine: engine.loadEngine,
      onStatus: (s) => states.push(s),
    });
    await flush();

    expect(states.at(-1).status).toBe("error");
    expect(states.at(-1).error).toBe(err);
  });

  it("reads a Blob source", async () => {
    const engine = fakeEngine([[600, 800]]);
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" });
    if (typeof blob.arrayBuffer !== "function") return; // older jsdom
    mountPdfPages(container, blob, { loadEngine: engine.loadEngine });
    await flush();
    await flush();

    const { data } = engine.pdfjs.getDocument.mock.calls[0][0];
    expect(Array.from(data)).toEqual([1, 2, 3]);
  });

  it("cancels pending renders, frees canvases and closes the document on destroy", async () => {
    const engine = fakeEngine([
      [600, 800],
      [600, 800],
    ]);
    const view = mountPdfPages(container, new Uint8Array([1]), { loadEngine: engine.loadEngine });
    await flush();
    engine.renders[0].resolve();
    await flush();
    const drawn = engine.renders[0].canvas;

    view.destroy();
    expect(engine.renders[1].cancel).toHaveBeenCalled();
    expect(drawn.width).toBe(0);
    expect(engine.loadingTask.destroy).toHaveBeenCalledTimes(1);
    expect(container.childNodes).toHaveLength(0);

    // Late status reports are ignored after destroy
    view.destroy();
    expect(engine.loadingTask.destroy).toHaveBeenCalledTimes(1);
  });

  it("stops quietly when destroyed while pdf.js is still loading", async () => {
    const engine = fakeEngine([[600, 800]]);
    const states = [];
    const view = mountPdfPages(container, new Uint8Array([1]), {
      loadEngine: engine.loadEngine,
      onStatus: (s) => states.push(s),
    });
    view.destroy();
    await flush();

    expect(engine.pdfjs.getDocument).not.toHaveBeenCalled();
    expect(states.map((s) => s.status)).toEqual(["loading"]);
  });
});

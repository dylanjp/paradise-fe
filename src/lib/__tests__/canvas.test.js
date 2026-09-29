/**
 * Tests for the JSON Canvas parser and the canvas view geometry helpers.
 * Fixtures follow the real vault canvases: empty "{}" files, preset and hex
 * colors, labelled edges, groups and fromEnd arrows.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  parseCanvas,
  CANVAS_PRESET_COLORS,
  resolveCanvasColor,
  sideAnchor,
  edgePath,
  fitView,
  zoomAround,
  rectsIntersect,
  isReleasedMouse,
} from "../canvas";

/** Trimmed copy of the vault's "Dialog Diagram.canvas" */
const DIALOG_DIAGRAM = JSON.stringify({
  nodes: [
    {
      id: "6e717e5fa63cb777",
      type: "text",
      text: "Amira_BP",
      x: -740,
      y: -480,
      width: 250,
      height: 60,
      color: "1",
    },
    {
      id: "dc0894943c218f18",
      type: "text",
      text: "NPC / Sign",
      x: 5,
      y: -860,
      width: 250,
      height: 60,
      color: "4",
    },
    {
      id: "f17814dfcbc16632",
      type: "file",
      file: "Developer Notes/SystemDialog/Dialog System.md",
      x: 360,
      y: -1160,
      width: 420,
      height: 580,
    },
    {
      id: "70934d4e2cbe29a6",
      type: "text",
      text: "AmiraLocalization Component C++",
      x: -1140,
      y: -480,
      width: 250,
      height: 60,
      color: "#00118f",
    },
    {
      id: "0f6f137eee36f880",
      type: "group",
      x: -1200,
      y: -1200,
      width: 2100,
      height: 800,
      label: "Core Loop",
    },
  ],
  edges: [
    {
      id: "d6ba44b37bd9f66d",
      fromNode: "6e717e5fa63cb777",
      fromSide: "right",
      toNode: "dc0894943c218f18",
      toSide: "left",
      label: "2",
    },
    {
      id: "4178bb6f94e6cf22",
      fromNode: "6e717e5fa63cb777",
      fromSide: "left",
      toNode: "70934d4e2cbe29a6",
      toSide: "top",
      label: "3",
      fromEnd: "arrow",
    },
  ],
});

/** U+FEFF byte order mark */
const BOM = String.fromCharCode(0xfeff);

const node = (id, x, y, width = 100, height = 50, extra = {}) => ({
  id,
  type: "text",
  text: id,
  x,
  y,
  width,
  height,
  ...extra,
});

describe("parseCanvas", () => {
  it("treats {} and empty input as an empty canvas", () => {
    for (const input of ["{}", "", "   ", null, undefined]) {
      const result = parseCanvas(input);
      expect(result.ok).toBe(true);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.bounds).toMatchObject({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  it("reports invalid JSON and unexpected shapes", () => {
    for (const input of ["{nodes:", "not json", "[]", "null", "42", '"x"']) {
      const result = parseCanvas(input);
      expect(result.ok).toBe(false);
      expect(typeof result.error).toBe("string");
    }
  });

  it("parses a real vault canvas", () => {
    const { ok, nodes, edges, bounds } = parseCanvas(DIALOG_DIAGRAM);
    expect(ok).toBe(true);
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(2);
    expect(nodes.find((n) => n.type === "file").file).toBe(
      "Developer Notes/SystemDialog/Dialog System.md",
    );
    expect(nodes.find((n) => n.type === "group").label).toBe("Core Loop");
    expect(nodes.find((n) => n.id === "70934d4e2cbe29a6").color).toBe(
      "#00118f",
    );
    expect(edges[0]).toMatchObject({
      label: "2",
      fromEnd: "none",
      toEnd: "arrow",
    });
    expect(edges[1]).toMatchObject({
      fromEnd: "arrow",
      toEnd: "arrow",
      toSide: "top",
    });
    expect(bounds).toMatchObject({
      x: -1200,
      y: -1200,
      width: 2100,
      height: 800,
    });
  });

  it("drops nodes with bad geometry, unknown types or duplicate ids", () => {
    const { nodes } = parseCanvas(
      JSON.stringify({
        nodes: [
          node("a", 0, 0),
          node("a", 500, 500),
          node("b", "10", 0),
          { ...node("c", 0, 0), width: null },
          { ...node("d", 0, 0), type: "iframe" },
          { ...node("e", 0, 0), id: "" },
          null,
          "x",
          node("f", 10, 20),
        ],
      }),
    );
    expect(nodes.map((n) => n.id)).toEqual(["a", "f"]);
    expect(nodes[0]).toMatchObject({ x: 0, y: 0 });
  });

  it("drops non-finite coordinates that JSON can express via huge numbers", () => {
    const { nodes } = parseCanvas(
      '{"nodes":[{"id":"a","type":"text","x":1e999,"y":0,"width":1,"height":1}]}',
    );
    expect(nodes).toEqual([]);
  });

  it("drops absurd geometry so the bounds math stays finite", () => {
    const { nodes, bounds } = parseCanvas(
      JSON.stringify({
        nodes: [
          node("big", 1e300, 1e300, 1e300, 1e300),
          node("wide", 0, 0, 2e8, 10),
          node("ok", -5000, 200000, 400, 300),
        ],
      }),
    );
    expect(nodes.map((n) => n.id)).toEqual(["ok"]);
    expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
  });

  it("ignores a leading byte order mark", () => {
    const result = parseCanvas(BOM + DIALOG_DIAGRAM);
    expect(result.ok).toBe(true);
    expect(result.nodes).toHaveLength(5);
    expect(parseCanvas(BOM)).toMatchObject({ ok: true, nodes: [] });
  });

  it("only links edges to real node ids and keeps edge ids unique", () => {
    const { edges } = parseCanvas(
      JSON.stringify({
        nodes: [node("undefined", 0, 0), node("a", 300, 0), node("7", 0, 300)],
        edges: [
          { id: "x", toNode: "a" },
          { id: "x", fromNode: null, toNode: "a" },
          { id: "e", fromNode: 7, toNode: "a" },
          { id: "e", fromNode: "a", toNode: "7" },
          { id: "e-1", fromNode: "a", toNode: "undefined" },
          { id: 5, fromNode: "7", toNode: "undefined" },
        ],
      }),
    );
    expect(edges.map((e) => [e.id, e.fromNode, e.toNode])).toEqual([
      ["e", "7", "a"],
      ["e-1", "a", "7"],
      ["e-1-1", "a", "undefined"],
      ["5", "7", "undefined"],
    ]);
  });

  it("validates colors", () => {
    const colors = [
      "1",
      "6",
      "#00118f",
      "#fff",
      "#ffff",
      3,
      "7",
      "0",
      "red",
      "#12345",
      "#gggggg",
      "url(javascript:alert(1))",
      "#fff;background:red",
    ];
    const { nodes } = parseCanvas(
      JSON.stringify({
        nodes: colors.map((color, i) =>
          node(`n${i}`, i * 10, 0, 10, 10, { color }),
        ),
      }),
    );
    expect(nodes.map((n) => n.color)).toEqual([
      "1",
      "6",
      "#00118f",
      "#fff",
      "#ffff",
      "3",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("keeps only http(s) link URLs", () => {
    const urls = [
      "https://example.com/a",
      "http://x.y",
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://x.y",
      5,
      "",
    ];
    const { nodes } = parseCanvas(
      JSON.stringify({
        nodes: urls.map((url, i) => ({
          id: `l${i}`,
          type: "link",
          url,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        })),
      }),
    );
    expect(nodes.map((n) => n.url)).toEqual([
      "https://example.com/a",
      "http://x.y/",
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("drops edges to missing nodes and fills in defaults", () => {
    const { edges } = parseCanvas(
      JSON.stringify({
        nodes: [node("a", 0, 0), node("b", 300, 0)],
        edges: [
          { id: "e1", fromNode: "a", toNode: "b" },
          { id: "e2", fromNode: "a", toNode: "missing" },
          { id: "e3", fromNode: "ghost", toNode: "b" },
          {
            fromNode: "b",
            toNode: "a",
            fromEnd: "arrow",
            toEnd: "none",
            color: "5",
          },
          {
            id: "e1",
            fromNode: "b",
            toNode: "a",
            fromEnd: "bogus",
            toEnd: "bogus",
            color: "javascript:",
          },
        ],
      }),
    );
    expect(edges).toHaveLength(3);
    expect(edges[0]).toMatchObject({
      id: "e1",
      fromEnd: "none",
      toEnd: "arrow",
      color: null,
      label: null,
    });
    expect(edges[1]).toMatchObject({
      fromEnd: "arrow",
      toEnd: "none",
      color: "5",
    });
    expect(edges[1].id).toBeTruthy();
    expect(edges[2]).toMatchObject({
      fromEnd: "none",
      toEnd: "arrow",
      color: null,
    });
    expect(edges[2].id).not.toBe("e1");
  });

  it("computes missing sides from node positions", () => {
    const nodes = [
      node("c", 0, 0),
      node("r", 400, 10),
      node("l", -400, -10),
      node("d", 10, 400),
      node("u", -10, -400),
    ];
    const sides = (to, extra = {}) =>
      parseCanvas(
        JSON.stringify({
          nodes,
          edges: [{ id: "e", fromNode: "c", toNode: to, ...extra }],
        }),
      ).edges[0];
    expect(sides("r")).toMatchObject({ fromSide: "right", toSide: "left" });
    expect(sides("l")).toMatchObject({ fromSide: "left", toSide: "right" });
    expect(sides("d")).toMatchObject({ fromSide: "bottom", toSide: "top" });
    expect(sides("u")).toMatchObject({ fromSide: "top", toSide: "bottom" });
    expect(sides("r", { fromSide: "top" })).toMatchObject({
      fromSide: "top",
      toSide: "left",
    });
    expect(sides("r", { toSide: "diagonal" })).toMatchObject({
      fromSide: "right",
      toSide: "left",
    });
  });
});

describe("colors", () => {
  it("maps presets 1-6 and hex colors", () => {
    expect(Object.keys(CANVAS_PRESET_COLORS)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ]);
    expect(resolveCanvasColor("1")).toBe(CANVAS_PRESET_COLORS[1]);
    expect(resolveCanvasColor("6")).toBe(CANVAS_PRESET_COLORS[6]);
    expect(resolveCanvasColor("#00118f")).toBe("#00118f");
    expect(resolveCanvasColor("7")).toBeNull();
    expect(resolveCanvasColor(null)).toBeNull();
    expect(resolveCanvasColor("red")).toBeNull();
  });
});

describe("geometry", () => {
  const box = { x: 100, y: 200, width: 40, height: 20 };

  it("anchors edges to the middle of each side", () => {
    expect(sideAnchor(box, "top")).toEqual({ x: 120, y: 200 });
    expect(sideAnchor(box, "right")).toEqual({ x: 140, y: 210 });
    expect(sideAnchor(box, "bottom")).toEqual({ x: 120, y: 220 });
    expect(sideAnchor(box, "left")).toEqual({ x: 100, y: 210 });
  });

  it("builds a cubic bezier between anchors with a midpoint label", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    const b = { x: 300, y: 0, width: 100, height: 100 };
    const path = edgePath(a, "right", b, "left");
    expect(path.from).toEqual({ x: 100, y: 50 });
    expect(path.to).toEqual({ x: 300, y: 50 });
    expect(path.d.startsWith("M 100 50 C ")).toBe(true);
    expect(path.d.endsWith(", 300 50")).toBe(true);
    expect(path.labelX).toBeCloseTo(200);
    expect(path.labelY).toBeCloseTo(50);
  });

  it("fits bounds inside the viewport without zooming past 100%", () => {
    const view = fitView(
      { x: 0, y: 0, width: 2000, height: 1000 },
      1000,
      600,
      50,
    );
    expect(view.scale).toBeCloseTo(0.45);
    // Center of the bounds lands at the center of the viewport
    expect(1000 * view.scale + view.x).toBeCloseTo(500);
    expect(500 * view.scale + view.y).toBeCloseTo(300);

    const small = fitView({ x: 10, y: 10, width: 50, height: 50 }, 1000, 600);
    expect(small.scale).toBe(1);
  });

  it("clamps zero-size bounds", () => {
    const view = fitView({ x: 100, y: 100, width: 0, height: 0 }, 800, 600, 40);
    expect(Number.isFinite(view.scale)).toBe(true);
    expect(view.scale).toBeLessThanOrEqual(1);
    expect(100 * view.scale + view.x).toBeCloseTo(400);
    expect(100 * view.scale + view.y).toBeCloseTo(300);

    const empty = fitView(parseCanvas("{}").bounds, 0, 0);
    expect(Object.values(empty).every(Number.isFinite)).toBe(true);

    for (const bad of [
      null,
      {},
      { x: NaN, y: Infinity, width: Infinity, height: -5 },
    ]) {
      const view = fitView(bad, 800, 600);
      expect(Object.values(view).every(Number.isFinite)).toBe(true);
    }
    expect(
      Object.values(
        fitView(parseCanvas("{}").bounds, NaN, undefined, NaN),
      ).every(Number.isFinite),
    ).toBe(true);
  });

  it("zoomAround leaves an unusable view alone", () => {
    for (const view of [
      { x: 0, y: 0, scale: 0 },
      { x: 0, y: 0, scale: NaN },
      { x: NaN, y: 0, scale: 1 },
    ]) {
      expect(zoomAround(view, 2, 10, 10)).toBe(view);
    }
    const view = { x: 0, y: 0, scale: 1 };
    expect(zoomAround(view, NaN, 10, 10)).toBe(view);
    expect(zoomAround(view, 2, Infinity, 10)).toBe(view);
  });

  it("zoomAround keeps the focal point fixed (property)", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        fc.double({ min: -5000, max: 5000, noNaN: true }),
        fc.double({ min: 0.05, max: 4, noNaN: true }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        fc.double({ min: 0, max: 2000, noNaN: true }),
        (x, y, scale, factor, px, py) => {
          const view = { x, y, scale };
          const next = zoomAround(view, factor, px, py, 0.05, 4);
          const worldBefore = {
            x: (px - view.x) / view.scale,
            y: (py - view.y) / view.scale,
          };
          const worldAfter = {
            x: (px - next.x) / next.scale,
            y: (py - next.y) / next.scale,
          };
          expect(next.scale).toBeGreaterThanOrEqual(0.05);
          expect(next.scale).toBeLessThanOrEqual(4);
          expect(Math.abs(worldAfter.x - worldBefore.x)).toBeLessThan(
            1e-6 * (1 + Math.abs(worldBefore.x)),
          );
          expect(Math.abs(worldAfter.y - worldBefore.y)).toBeLessThan(
            1e-6 * (1 + Math.abs(worldBefore.y)),
          );
        },
      ),
    );
  });

  it("detects rectangle overlap", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(true);
    expect(rectsIntersect(a, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
    expect(rectsIntersect(a, { x: 0, y: -20, width: 5, height: 5 })).toBe(
      false,
    );
    expect(
      rectsIntersect(a, { x: -100, y: -100, width: 500, height: 500 }),
    ).toBe(true);
  });
});

describe("pointer gestures", () => {
  it("treats a mouse move with no button held as a finished press", () => {
    // Press released outside the viewport before the pan began: the next move
    // over the canvas reports buttons 0 and must not start panning
    expect(isReleasedMouse({ pointerType: "mouse", buttons: 0 })).toBe(true);
    expect(isReleasedMouse({ pointerType: "mouse", buttons: 1 })).toBe(false);
    expect(isReleasedMouse({ pointerType: "mouse", buttons: 4 })).toBe(false);
    // Only mouse pointers are judged this way
    expect(isReleasedMouse({ pointerType: "touch", buttons: 0 })).toBe(false);
    expect(isReleasedMouse({ pointerType: "pen", buttons: 0 })).toBe(false);
    expect(isReleasedMouse(null)).toBe(false);
  });
});

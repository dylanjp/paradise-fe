/**
 * Tests for the documentation hook's document loading: a doc that failed to
 * load is loaded again when it's selected again or the tree is refreshed.
 * Rendered with createElement (no JSX) and a mocked docsService.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useDocumentation } from "../useDocumentation";
import * as docsService from "../../src/lib/docsService";

vi.mock("../../src/lib/docsService", () => ({
  fetchDocsTree: vi.fn(),
  fetchDocsFile: vi.fn(),
  fetchDocsRawBlob: vi.fn(),
  fetchDocsEmbedBlob: vi.fn(),
  refreshDocsTree: vi.fn(),
}));

const TREE = {
  name: "",
  type: "folder",
  path: "",
  children: [
    { name: "A.md", type: "file", path: "A.md", children: null },
    { name: "B.md", type: "file", path: "B.md", children: null },
  ],
};

/** Renders the hook; `hook.current` is its latest return value */
async function renderHook({ strict = false } = {}) {
  const hook = { current: null };
  function Harness() {
    hook.current = useDocumentation();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  const element = createElement(Harness);
  await act(async () => {
    root.render(strict ? createElement(StrictMode, null, element) : element);
  });
  return { hook, unmount: () => act(() => root.unmount()) };
}

/** Runs an action inside act() and lets the resulting promises settle */
async function run(action) {
  await act(async () => {
    await action();
  });
}

/** Number of /docs/file fetches made for a path */
function fetchesOf(path) {
  return docsService.fetchDocsFile.mock.calls.filter(([p]) => p === path).length;
}

describe("useDocumentation: retrying a failed document", () => {
  let unmount = null;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    docsService.fetchDocsTree.mockResolvedValue(TREE);
    docsService.refreshDocsTree.mockResolvedValue(TREE);
  });

  afterEach(async () => {
    if (unmount) await unmount();
    unmount = null;
  });

  it("loads a failed doc again when it is selected again", async () => {
    docsService.fetchDocsFile
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue("# B");
    const view = await renderHook();
    unmount = view.unmount;

    await run(() => view.hook.current.selectFile("B.md"));
    expect(view.hook.current.doc).toMatchObject({ path: "B.md", error: "network down" });
    expect(fetchesOf("B.md")).toBe(1);

    await run(() => view.hook.current.selectFile("B.md"));
    expect(fetchesOf("B.md")).toBe(2);
    expect(view.hook.current.doc).toMatchObject({ path: "B.md", text: "# B", error: null });
  });

  it("does not reload a doc that loaded fine when it is selected again", async () => {
    docsService.fetchDocsFile.mockResolvedValue("# B");
    const view = await renderHook();
    unmount = view.unmount;

    await run(() => view.hook.current.selectFile("B.md"));
    const loaded = view.hook.current.doc;
    await run(() => view.hook.current.selectFile("B.md"));

    expect(fetchesOf("B.md")).toBe(1);
    expect(view.hook.current.doc).toBe(loaded);
  });

  it("loads a failed doc again on refresh", async () => {
    docsService.fetchDocsFile
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue("# B");
    const view = await renderHook();
    unmount = view.unmount;

    await run(() => view.hook.current.selectFile("B.md"));
    expect(view.hook.current.doc.error).toBe("network down");

    await run(() => view.hook.current.refreshTree());
    expect(docsService.refreshDocsTree).toHaveBeenCalledTimes(1);
    expect(fetchesOf("B.md")).toBe(2);
    expect(view.hook.current.doc).toMatchObject({ path: "B.md", text: "# B", error: null });
  });

  it("retries under StrictMode's double effects too", async () => {
    docsService.fetchDocsFile.mockRejectedValue(new Error("network down"));
    const view = await renderHook({ strict: true });
    unmount = view.unmount;

    await run(() => view.hook.current.selectFile("B.md"));
    expect(view.hook.current.doc.error).toBe("network down");

    docsService.fetchDocsFile.mockResolvedValue("# B");
    await run(() => view.hook.current.selectFile("B.md"));
    expect(view.hook.current.doc).toMatchObject({ path: "B.md", text: "# B", error: null });
  });
});

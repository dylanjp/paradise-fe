/**
 * Tests for docs embed hydration: images, PDFs and embedded notes are filled in
 * from a (fake) resource cache after the sanitized HTML is in the page, failures
 * become inert ".docs-embed-missing" labels, and cancelling makes late results
 * a no-op.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hydrateDocsEmbeds, findHeadingForLink, nextFragmentIdPrefix } from "../docsEmbeds";
import { buildDocsIndex, renderObsidianMarkdown } from "../obsidian";
import { sanitizeHtml } from "../sanitizeHtml";

const NOTE = "LE Docs/Characters/Amira/Amira.md";
const OTHER = "LE Docs/Characters/Daken/Daken.md";
const BOARD = "LE Docs/Characters/Amira/Amira Board.canvas";

const TREE = {
  name: "",
  type: "folder",
  path: "",
  children: [
    {
      name: "LE Docs",
      type: "folder",
      path: "LE Docs",
      root: true,
      children: [
        {
          name: "Characters",
          type: "folder",
          path: "LE Docs/Characters",
          children: [
            {
              name: "Amira",
              type: "folder",
              path: "LE Docs/Characters/Amira",
              children: [
                { name: "Amira.md", type: "file", path: NOTE, children: null },
                { name: "Amira Board.canvas", type: "file", path: BOARD, children: null },
              ],
            },
            {
              name: "Daken",
              type: "folder",
              path: "LE Docs/Characters/Daken",
              children: [{ name: "Daken.md", type: "file", path: OTHER, children: null }],
            },
          ],
        },
      ],
    },
  ],
};

const INDEX = buildDocsIndex(TREE);

/** A promise that can be settled from the outside */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Lets pending promise callbacks run */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** An AbortError like the one a disposed cache rejects with */
function abortError() {
  const err = new Error("disposed");
  err.name = "AbortError";
  return err;
}

/** Renders + sanitizes markdown into a container attached to the document */
function mount(markdown, currentPath = NOTE) {
  const root = document.createElement("div");
  root.innerHTML = sanitizeHtml(renderObsidianMarkdown(markdown, { currentPath, index: INDEX }));
  document.body.appendChild(root);
  return root;
}

/**
 * Fake resource cache. Embed URLs resolve to "blob:test/<target>" unless the
 * target is listed in `missing`; note texts come from `texts`.
 */
function fakeCache({ missing = [], texts = {} } = {}) {
  return {
    getEmbedUrl: vi.fn(async (from, target) => {
      if (missing.includes(target)) {
        const err = new Error("Documentation file not found");
        err.status = 404;
        throw err;
      }
      return `blob:test/${target}`;
    }),
    getText: vi.fn(async (path) => {
      if (!(path in texts)) throw new Error("Documentation file not found");
      return texts[path];
    }),
  };
}

describe("hydrateDocsEmbeds", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets image src from the cache using the embed's from/target", async () => {
    const root = mount("![[Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg|300]]");
    const cache = fakeCache();

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await flush();

    expect(cache.getEmbedUrl).toHaveBeenCalledWith(
      NOTE,
      "Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg",
      { literal: false },
    );
    const img = root.querySelector("img.docs-embed-image");
    expect(img.getAttribute("src")).toBe(
      "blob:test/Attachments/Pictures/Amira/Official_Amira_Artwork2.jpg",
    );
    expect(img.getAttribute("width")).toBe("300");
    expect(img.hasAttribute("data-embed-done")).toBe(true);
  });

  it("passes literal=true for markdown images whose decoded name contains '#'", async () => {
    const root = mount("![clair](%23ClairLineArt.jpg)");
    const cache = fakeCache();

    hydrateDocsEmbeds(root, cache);
    await flush();

    expect(cache.getEmbedUrl).toHaveBeenCalledWith(NOTE, "#ClairLineArt.jpg", { literal: true });
    expect(root.querySelector("img").getAttribute("src")).toBe("blob:test/#ClairLineArt.jpg");
  });

  it("replaces a missing image with an inert text label", async () => {
    const target = 'Leto <img src=x onerror="alert(1)"><b>x.png';
    const root = document.createElement("div");
    const img = document.createElement("img");
    img.className = "docs-embed-image";
    img.setAttribute("data-embed-target", target);
    img.setAttribute("data-embed-from", NOTE);
    root.appendChild(img);
    document.body.appendChild(root);

    hydrateDocsEmbeds(root, fakeCache({ missing: [target] }));
    await flush();

    expect(root.querySelector("img")).toBeNull();
    const label = root.querySelector(".docs-embed-missing");
    expect(label).not.toBeNull();
    expect(label.textContent).toBe(`Missing image: ${target}`);
    expect(label.title).toBe(target);
    // The hostile name stays text: no element or handler was created from it
    expect(label.children.length).toBe(0);
    expect(root.querySelectorAll("*")).toHaveLength(1);
    expect(label.getAttributeNames().some((n) => n.startsWith("on"))).toBe(false);
  });

  it("marks an image missing when the loaded URL fails to decode", async () => {
    const root = mount("![[broken.png]]");
    hydrateDocsEmbeds(root, fakeCache());
    await flush();

    const img = root.querySelector("img");
    img.dispatchEvent(new Event("error"));
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector(".docs-embed-missing").textContent).toBe("Missing image: broken.png");
  });

  it("leaves images untouched when the cache was disposed (AbortError)", async () => {
    const root = mount("![[pic.png]]");
    const cache = fakeCache();
    cache.getEmbedUrl.mockImplementation(async () => {
      throw abortError();
    });

    hydrateDocsEmbeds(root, cache);
    await flush();

    const img = root.querySelector("img");
    expect(img).not.toBeNull();
    expect(img.hasAttribute("src")).toBe(false);
    expect(root.querySelector(".docs-embed-missing")).toBeNull();
  });

  it("ignores results that arrive after cancel", async () => {
    const root = mount("![[pic.png]]\n\n![[gone.png]]\n\n![[Daken]]");
    const pending = [];
    const cache = {
      getEmbedUrl: vi.fn(() => {
        const d = deferred();
        pending.push(d);
        return d.promise;
      }),
      getText: vi.fn(() => {
        const d = deferred();
        pending.push(d);
        return d.promise;
      }),
    };

    const cancel = hydrateDocsEmbeds(root, cache, { index: INDEX });
    const before = root.innerHTML;
    cancel();

    pending[0].resolve("blob:test/late");
    pending[1].reject(new Error("not found"));
    pending[2].resolve("# Daken\ntext");
    await flush();

    expect(root.innerHTML).toBe(before);
    expect(root.querySelector("img").hasAttribute("src")).toBe(false);
  });

  it("shows an inline PDF frame when the browser has a PDF viewer", async () => {
    const root = mount("![[Manual.pdf]]");
    const cache = fakeCache();

    hydrateDocsEmbeds(root, cache, { pdfViewerEnabled: true });
    await flush();

    expect(cache.getEmbedUrl).toHaveBeenCalledWith(NOTE, "Manual.pdf", { literal: false });
    const frame = root.querySelector(".docs-embed-pdf iframe");
    expect(frame).not.toBeNull();
    expect(frame.getAttribute("src")).toBe("blob:test/Manual.pdf");
    expect(frame.getAttribute("title")).toBe("Manual.pdf");
  });

  it("falls back to a Download button without a PDF viewer", async () => {
    const root = mount("![[Manual.pdf]]");

    hydrateDocsEmbeds(root, fakeCache(), { pdfViewerEnabled: false });
    await flush();

    expect(root.querySelector("iframe")).toBeNull();
    const button = root.querySelector(".docs-embed-pdf button.docs-embed-download");
    expect(button).not.toBeNull();
    expect(button.textContent).toBe("Download PDF");

    const clicks = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() {
      clicks.push({ href: this.getAttribute("href"), download: this.download });
    };
    try {
      button.click();
    } finally {
      HTMLAnchorElement.prototype.click = origClick;
    }
    expect(clicks).toEqual([{ href: "blob:test/Manual.pdf", download: "Manual.pdf" }]);
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("labels a PDF that can't be found", async () => {
    const root = mount("![[Nope.pdf]]");
    hydrateDocsEmbeds(root, fakeCache({ missing: ["Nope.pdf"] }), { pdfViewerEnabled: true });
    await flush();

    expect(root.querySelector("iframe")).toBeNull();
    expect(root.querySelector(".docs-embed-pdf .docs-embed-missing").textContent).toBe(
      "Missing PDF: Nope.pdf",
    );
  });

  it("renders an embedded note as the embedded doc, sanitized, and hydrates it", async () => {
    const root = mount("Intro\n\n![[Daken]]");
    const cache = fakeCache({
      texts: {
        [OTHER]:
          '# Daken\n<img src=x onerror="alert(1)"><script>alert(2)</script>\n\n![[daken.png]]\n\n![[Amira]]\n\n[[Amira]]',
      },
    });

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await flush();
    await flush();

    expect(cache.getText).toHaveBeenCalledWith(OTHER);
    const note = root.querySelector(".docs-embed-note");
    expect(note.hasAttribute("data-embed-done")).toBe(true);

    // Title link navigates to the embedded note
    const title = note.querySelector(".docs-embed-note-title");
    expect(title.getAttribute("data-doc-link")).toBe(OTHER);
    expect(title.textContent).toBe("Daken");

    // Sanitized: no script, no handlers
    expect(note.querySelector("script")).toBeNull();
    for (const el of note.querySelectorAll("*")) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.startsWith("on")).toBe(false);
      }
    }

    // The note's own image is resolved from the embedded note, not the host
    expect(cache.getEmbedUrl).toHaveBeenCalledWith(OTHER, "daken.png", { literal: false });
    expect(note.querySelector("img.docs-embed-image").getAttribute("src")).toBe(
      "blob:test/daken.png",
    );

    // embedDepth 1: a nested note embed becomes a link, not another expansion
    expect(note.querySelector("[data-embed-note]")).toBeNull();
    const nested = note.querySelector(".docs-embed-link");
    expect(nested.getAttribute("data-doc-link")).toBe(NOTE);
    expect(cache.getText).toHaveBeenCalledTimes(1);

    // Links inside resolve relative to the embedded note
    const links = Array.from(note.querySelectorAll("[data-doc-link]")).map((a) =>
      a.getAttribute("data-doc-link"),
    );
    expect(links).toContain(NOTE);
  });

  it("labels an embedded note that fails to load", async () => {
    const root = mount("![[Daken]]");
    hydrateDocsEmbeds(root, fakeCache(), { index: INDEX });
    await flush();

    const note = root.querySelector(".docs-embed-note");
    expect(note.querySelector(".docs-embed-missing").textContent).toBe(
      "Could not load embedded note: Daken",
    );
  });

  it("is idempotent: a second pass skips finished embeds", async () => {
    const root = mount("![[pic.png]]\n\n![[Daken]]\n\n![[Manual.pdf]]");
    const cache = fakeCache({ texts: { [OTHER]: "![[inner.png]]" } });

    hydrateDocsEmbeds(root, cache, { index: INDEX, pdfViewerEnabled: true });
    await flush();
    await flush();
    const html = root.innerHTML;
    const embedCalls = cache.getEmbedUrl.mock.calls.length;
    const textCalls = cache.getText.mock.calls.length;

    hydrateDocsEmbeds(root, cache, { index: INDEX, pdfViewerEnabled: true });
    await flush();

    expect(root.innerHTML).toBe(html);
    expect(cache.getEmbedUrl.mock.calls.length).toBe(embedCalls);
    expect(cache.getText.mock.calls.length).toBe(textCalls);
    expect(root.querySelectorAll("iframe").length).toBe(1);
  });

  it("retries unfinished embeds after a cancelled pass (StrictMode remount)", async () => {
    const root = mount("![[pic.png]]");
    const cache = fakeCache();

    const cancel = hydrateDocsEmbeds(root, cache);
    cancel();
    hydrateDocsEmbeds(root, cache);
    await flush();

    expect(root.querySelector("img").getAttribute("src")).toBe("blob:test/pic.png");
  });

  it("defers images until they intersect when IntersectionObserver exists", async () => {
    const observers = [];
    class FakeObserver {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.targets = new Set();
        this.disconnected = false;
        observers.push(this);
      }
      observe(el) {
        this.targets.add(el);
      }
      unobserve(el) {
        this.targets.delete(el);
      }
      disconnect() {
        this.disconnected = true;
        this.targets.clear();
      }
      fire(el) {
        this.callback([{ target: el, isIntersecting: true }]);
      }
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const scrollRoot = document.createElement("div");
    const root = mount("![[a.png]]\n\n![[b.png]]");
    scrollRoot.appendChild(root);
    document.body.appendChild(scrollRoot);
    const cache = fakeCache();

    const cancel = hydrateDocsEmbeds(root, cache, { scrollRoot });
    expect(observers).toHaveLength(1);
    expect(observers[0].options.root).toBe(scrollRoot);
    expect(cache.getEmbedUrl).not.toHaveBeenCalled();

    const [a, b] = root.querySelectorAll("img");
    observers[0].fire(a);
    await flush();
    expect(cache.getEmbedUrl).toHaveBeenCalledTimes(1);
    expect(a.getAttribute("src")).toBe("blob:test/a.png");
    expect(b.hasAttribute("src")).toBe(false);

    cancel();
    expect(observers[0].disconnected).toBe(true);
    observers[0].fire(b);
    await flush();
    expect(cache.getEmbedUrl).toHaveBeenCalledTimes(1);
  });

  it("returns a no-op cancel for a missing root or cache", () => {
    expect(() => hydrateDocsEmbeds(null, fakeCache())()).not.toThrow();
    expect(() => hydrateDocsEmbeds(document.createElement("div"), null)()).not.toThrow();
  });
});

describe("hydrateDocsEmbeds: note embeds can't recurse", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  /**
   * Fake cache whose getText gives up after `cap` calls, so a runaway loop (which
   * never yields to the event loop) ends and fails the assertions instead of
   * hanging the test run.
   */
  function cappedCache(texts, cap = 25) {
    const cache = fakeCache({ texts });
    const real = cache.getText.getMockImplementation();
    cache.getText.mockImplementation(async (path) => {
      if (cache.getText.mock.calls.length > cap) throw new Error("runaway recursion");
      return real(path);
    });
    return cache;
  }

  async function settle() {
    for (let i = 0; i < 5; i++) await flush();
  }

  it("expands a raw-HTML self-embed once and links the nested copy", async () => {
    // Raw HTML skips the renderer's embedDepth check (no data-embed-from either)
    const text = `Hello\n\n<div data-embed-note="${NOTE}"></div>`;
    const root = mount(text);
    const cache = cappedCache({ [NOTE]: text });

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await settle();

    expect(cache.getText).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll(".docs-embed-note-body")).toHaveLength(1);
    const nested = root.querySelector(".docs-embed-note-body [data-embed-note]");
    expect(nested.hasAttribute("data-embed-done")).toBe(true);
    const link = nested.querySelector("a.docs-embed-link");
    expect(link.getAttribute("data-doc-link")).toBe(NOTE);
    expect(link.textContent).toBe("Amira");
    expect(root.querySelector(".docs-embed-missing")).toBeNull();
  });

  it("stops notes that embed each other through raw HTML", async () => {
    const root = mount(`<div data-embed-note="${OTHER}"></div>`);
    const cache = cappedCache({
      [OTHER]: `Daken\n\n<div data-embed-note="${NOTE}"></div>`,
      [NOTE]: `Amira\n\n<div data-embed-note="${OTHER}"></div>`,
    });

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await settle();

    expect(cache.getText.mock.calls.map(([p]) => p)).toEqual([OTHER]);
    expect(root.querySelectorAll(".docs-embed-note-body")).toHaveLength(1);
    expect(
      root.querySelector(".docs-embed-note-body a.docs-embed-link").getAttribute("data-doc-link"),
    ).toBe(NOTE);

    // A second pass (StrictMode remount) doesn't expand the nested embed either
    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await settle();
    expect(cache.getText).toHaveBeenCalledTimes(1);
  });

  it("links a note that embeds itself instead of expanding it", async () => {
    const root = mount("Intro\n\n![[Amira]]");
    const cache = cappedCache({ [NOTE]: "Intro\n\n![[Amira]]" });

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await settle();

    expect(cache.getText).not.toHaveBeenCalled();
    const embed = root.querySelector(".docs-embed-note");
    expect(embed.querySelector("a.docs-embed-link").getAttribute("data-doc-link")).toBe(NOTE);
  });
});

describe("hydrateDocsEmbeds: heading ids of embedded notes", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("gives an embedded note its own heading ids and scopes its links to them", async () => {
    const root = mount("![[Daken]]\n\n## Setup\n\n[[#Setup]]");
    const cache = fakeCache({ texts: { [OTHER]: "## Setup\n\n[[#Setup]] [up](#Setup)" } });

    hydrateDocsEmbeds(root, cache, { index: INDEX });
    await flush();
    await flush();

    const ids = Array.from(root.querySelectorAll("[id]"), (el) => el.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);

    const body = root.querySelector(".docs-embed-note-body");
    const innerHeading = body.querySelector("h2");
    const hostHeading = Array.from(root.querySelectorAll("h2")).find((h) => !body.contains(h));
    expect(hostHeading.id).toBe("docs-h-setup");
    expect(innerHeading.id).toMatch(/^docs-h-f\d+-setup$/);

    // Links inside the embed point at the embed's heading, the host's at its own
    const innerLinks = Array.from(body.querySelectorAll("a[href^='#docs-h-']"));
    expect(innerLinks.map((a) => a.getAttribute("href"))).toEqual([
      `#${innerHeading.id}`,
      `#${innerHeading.id}`,
    ]);
    const hostLink = Array.from(root.querySelectorAll("a[href^='#docs-h-']")).find(
      (a) => !body.contains(a),
    );
    expect(hostLink.getAttribute("href")).toBe("#docs-h-setup");

    expect(findHeadingForLink(root, innerLinks[0], innerHeading.id)).toBe(innerHeading);
    expect(findHeadingForLink(root, hostLink, "docs-h-setup")).toBe(hostHeading);
  });

  it("only finds headings in the link's own fragment", () => {
    // Same id in the host and in an embed (e.g. a host heading "F1 Setup")
    const root = document.createElement("div");
    root.innerHTML =
      '<h2 id="docs-h-f1-setup">host</h2><a id="host-link" href="#docs-h-f1-setup">x</a>' +
      '<div class="docs-embed-note"><div class="docs-embed-note-body">' +
      '<a id="inner-link" href="#docs-h-f1-setup">y</a><h2 id="docs-h-f1-setup">inner</h2>' +
      '<a id="inner-missing" href="#docs-h-other">z</a></div></div>' +
      '<h2 id="docs-h-other">host only</h2>';
    const [hostHeading, innerHeading] = root.querySelectorAll("h2");

    expect(findHeadingForLink(root, root.querySelector("#host-link"), "docs-h-f1-setup")).toBe(
      hostHeading,
    );
    expect(findHeadingForLink(root, root.querySelector("#inner-link"), "docs-h-f1-setup")).toBe(
      innerHeading,
    );
    expect(findHeadingForLink(root, root.querySelector("#inner-missing"), "docs-h-other")).toBeNull();
    // Ids outside the heading rule are never looked up
    expect(findHeadingForLink(root, root.querySelector("#host-link"), 'x"] , *[id="')).toBeNull();
    expect(findHeadingForLink(null, root.querySelector("#host-link"), "docs-h-f1-setup")).toBeNull();
  });

  it("hands out distinct id prefixes the renderer accepts", () => {
    const a = nextFragmentIdPrefix();
    const b = nextFragmentIdPrefix();
    expect(a).not.toBe(b);
    for (const prefix of [a, b]) {
      expect(prefix).toMatch(/^[a-z0-9-]{1,40}$/);
      const html = sanitizeHtml(renderObsidianMarkdown("# T", { idPrefix: prefix }));
      expect(html).toContain(`id="docs-h-${prefix}t"`);
    }
  });
});

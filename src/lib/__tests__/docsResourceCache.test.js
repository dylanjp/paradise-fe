/**
 * Tests for the per-document resource cache: the concurrency cap, shared
 * in-flight fetches, eviction of failures, and cleanup on dispose()
 * (aborting fetches and revoking every object URL).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDocsResourceCache } from "../docsResourceCache";

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

/** Lets queued microtasks and timers run */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createDocsResourceCache", () => {
  let created;
  let revoked;
  let originalCreate;
  let originalRevoke;
  let pending;
  let fetchEmbed;
  let fetchText;

  beforeEach(() => {
    created = [];
    revoked = [];
    pending = [];
    originalCreate = URL.createObjectURL;
    originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn((blob) => {
      const url = `blob:mock/${created.length + 1}`;
      created.push({ url, blob });
      return url;
    });
    URL.revokeObjectURL = vi.fn((url) => revoked.push(url));

    fetchEmbed = vi.fn((from, target, { literal, signal }) => {
      const d = deferred();
      pending.push({ kind: "embed", from, target, literal, signal, ...d });
      return d.promise;
    });
    fetchText = vi.fn((path, { signal }) => {
      const d = deferred();
      pending.push({ kind: "text", path, signal, ...d });
      return d.promise;
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  const png = () => new Blob(["png"], { type: "image/png" });

  it("runs at most 4 fetches at a time", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    const results = Array.from({ length: 6 }, (_, i) =>
      cache.getEmbedUrl("Note.md", `img${i}.png`),
    );
    cache.getText("Other.md");
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(4);
    expect(fetchText).not.toHaveBeenCalled();

    pending[0].resolve(png());
    await expect(results[0]).resolves.toBe("blob:mock/1");
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(5);

    pending[1].reject(new Error("404"));
    await expect(results[1]).rejects.toThrow("404");
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(6);
    expect(fetchText).not.toHaveBeenCalled();

    pending[2].resolve(png());
    await flush();
    expect(fetchText).toHaveBeenCalledTimes(1);
    cache.dispose();
  });

  it("respects a custom concurrency", async () => {
    const cache = createDocsResourceCache({
      fetchEmbed,
      fetchText,
      concurrency: 1,
    });
    cache.getEmbedUrl("a.md", "1.png");
    cache.getEmbedUrl("a.md", "2.png");
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(1);
    cache.dispose();
  });

  it("shares in-flight and completed fetches per key", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    const a = cache.getEmbedUrl("Note.md", "pic.png");
    const b = cache.getEmbedUrl("Note.md", "pic.png");
    expect(a).toBe(b);
    const literal = cache.getEmbedUrl("Note.md", "pic.png", { literal: true });
    expect(literal).not.toBe(a);
    const otherFrom = cache.getEmbedUrl("Other.md", "pic.png");
    expect(otherFrom).not.toBe(a);
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(3);
    expect(pending[1].literal).toBe(true);

    pending[0].resolve(png());
    const url = await a;
    expect(cache.getEmbedUrl("Note.md", "pic.png")).toBe(a);
    await expect(cache.getEmbedUrl("Note.md", "pic.png")).resolves.toBe(url);

    const t1 = cache.getText("Faithkeeper.md");
    expect(cache.getText("Faithkeeper.md")).toBe(t1);
    await flush();
    pending[3].resolve("# Faithkeeper");
    await expect(t1).resolves.toBe("# Faithkeeper");
    expect(fetchText).toHaveBeenCalledTimes(1);
    cache.dispose();
  });

  it("evicts rejected entries so they can be retried", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    const first = cache.getEmbedUrl("Note.md", "pic.png");
    await flush();
    pending[0].reject(new Error("network"));
    await expect(first).rejects.toThrow("network");

    const second = cache.getEmbedUrl("Note.md", "pic.png");
    expect(second).not.toBe(first);
    await flush();
    expect(fetchEmbed).toHaveBeenCalledTimes(2);
    pending[1].resolve(png());
    await expect(second).resolves.toMatch(/^blob:mock\//);

    const text = cache.getText("A.md");
    await flush();
    pending[2].reject(new Error("gone"));
    await expect(text).rejects.toThrow("gone");
    expect(cache.getText("A.md")).not.toBe(text);
    cache.dispose();
  });

  it("uses a data: URL for SVG and a retyped object URL otherwise", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    const svg = cache.getEmbedUrl("Note.md", "diagram.svg|300");
    const jpg = cache.getEmbedUrl("Board.canvas", "#ClairLineArt.jpg", {
      literal: true,
    });
    await flush();
    pending[0].resolve(
      new Blob(["<svg xmlns='http://www.w3.org/2000/svg'/>"], {
        type: "image/svg+xml",
      }),
    );
    pending[1].resolve(new Blob(["jpg"], { type: "text/html" }));
    await expect(svg).resolves.toMatch(/^data:image\/svg\+xml/);
    await expect(jpg).resolves.toBe("blob:mock/1");
    expect(created).toHaveLength(1);
    expect(created[0].blob.type).toBe("image/jpeg");
    cache.dispose();
  });

  it("revokes a URL created while dispose() was running", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    // dispose() lands between createObjectURL and the cache storing the URL
    URL.createObjectURL = vi.fn(() => {
      cache.dispose();
      created.push({ url: "blob:mock/late" });
      return "blob:mock/late";
    });
    const url = cache.getEmbedUrl("n.md", "a.png");
    await flush();
    pending[0].resolve(png());
    await expect(url).rejects.toMatchObject({ name: "AbortError" });
    expect(revoked).toEqual(["blob:mock/late"]);
  });

  it("rejects work requested after dispose() without fetching", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    cache.dispose();
    await expect(cache.getEmbedUrl("n.md", "a.png")).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(cache.getText("n.md")).rejects.toMatchObject({
      name: "AbortError",
    });
    await flush();
    expect(fetchEmbed).not.toHaveBeenCalled();
    expect(fetchText).not.toHaveBeenCalled();
  });

  it("surfaces non-blob fetch results as rejections and evicts them", async () => {
    const cache = createDocsResourceCache({ fetchEmbed, fetchText });
    const bad = cache.getEmbedUrl("n.md", "a.png");
    await flush();
    pending[0].resolve(undefined);
    await expect(bad).rejects.toBeInstanceOf(Error);
    expect(cache.getEmbedUrl("n.md", "a.png")).not.toBe(bad);
    cache.dispose();
  });

  it("dispose() aborts fetches, rejects queued work and revokes every URL", async () => {
    // Concurrency 2: a+b finish, then c and t run while d waits in the queue
    const cache = createDocsResourceCache({
      fetchEmbed,
      fetchText,
      concurrency: 2,
    });
    const done = [
      cache.getEmbedUrl("n.md", "a.png"),
      cache.getEmbedUrl("n.md", "b.png"),
    ];
    const inFlight = cache.getEmbedUrl("n.md", "c.png");
    const text = cache.getText("t.md");
    const queued = cache.getEmbedUrl("n.md", "d.png");
    await flush();
    pending[0].resolve(png());
    pending[1].resolve(png());
    await Promise.all(done);
    await flush();

    const signals = pending.map((p) => p.signal);
    expect(signals.every((s) => s && !s.aborted)).toBe(true);

    expect(fetchEmbed).toHaveBeenCalledTimes(3);
    expect(fetchText).toHaveBeenCalledTimes(1);

    cache.dispose();
    expect(signals.every((s) => s.aborted)).toBe(true);
    // d never started
    expect(fetchEmbed).toHaveBeenCalledTimes(3);
    expect(revoked.sort()).toEqual(["blob:mock/1", "blob:mock/2"]);
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });

    // Late results after dispose never create (or leak) object URLs
    const inFlightEntry = pending.find((p) => p.target === "c.png");
    inFlightEntry.resolve(png());
    await expect(inFlight).rejects.toMatchObject({ name: "AbortError" });
    pending.find((p) => p.kind === "text").resolve("late");
    await expect(text).rejects.toMatchObject({ name: "AbortError" });
    expect(created).toHaveLength(2);

    await expect(cache.getEmbedUrl("n.md", "a.png")).rejects.toMatchObject({
      name: "AbortError",
    });
    await expect(cache.getText("t.md")).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(() => cache.dispose()).not.toThrow();
  });
});

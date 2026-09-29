/**
 * Docs Resource Cache
 * Per-document cache for embedded images/PDFs (as display URLs) and embedded
 * note text. Create one per open document and dispose() it when the document
 * changes: that aborts in-flight fetches and revokes every object URL.
 *
 * - Fetches are shared per key, so the same image embedded twice loads once.
 * - At most `concurrency` fetches run at a time (large vault images add up fast).
 * - Rejected entries are evicted so a later attempt can retry.
 * - The cache owns the only AbortController; consumers that unmount should just
 *   ignore late results instead of aborting a fetch another consumer shares.
 */

import { getExtension, blobToDisplayUrl } from "./fileTypes";

/** Creates the error used for work cancelled by dispose() */
function abortError() {
  const err = new Error("Docs resource cache disposed");
  err.name = "AbortError";
  return err;
}

/** Extension of an embed target, ignoring Obsidian's "#heading" / "|size" suffixes */
function embedExtension(target, literal) {
  const clean = literal ? String(target) : String(target).split(/[|#^]/)[0];
  return getExtension(clean.trim());
}

/**
 * @param {object} options
 * @param {(from: string, target: string, opts: {literal: boolean, signal: AbortSignal}) => Promise<Blob>} options.fetchEmbed
 * @param {(path: string, opts: {signal: AbortSignal}) => Promise<string>} options.fetchText
 * @param {number} [options.concurrency=4] - Maximum parallel fetches
 * @returns {{getEmbedUrl: Function, getText: Function, dispose: Function}}
 */
export function createDocsResourceCache({
  fetchEmbed,
  fetchText,
  concurrency = 4,
}) {
  const controller = new AbortController();
  const limit = Math.max(1, Math.floor(Number(concurrency)) || 1);
  const embedEntries = new Map();
  const textEntries = new Map();
  const revokers = new Set();
  const queue = [];
  const running = new Set();
  let active = 0;
  let disposed = false;

  /** Starts queued jobs while there is capacity */
  function pump() {
    while (active < limit && queue.length > 0) {
      const job = queue.shift();
      if (disposed) {
        job.reject(abortError());
        continue;
      }
      active++;
      running.add(job);
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          running.delete(job);
          active--;
          pump();
        });
    }
  }

  /** Runs a task once a concurrency slot is free */
  function schedule(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      pump();
    });
  }

  /** Stores a shared promise and evicts it again if it rejects */
  function remember(map, key, promise) {
    map.set(key, promise);
    promise.catch(() => {
      if (map.get(key) === promise) map.delete(key);
    });
    return promise;
  }

  /**
   * Returns a display URL (object URL, or data: URL for SVG) for an embedded file.
   * @param {string} from - Tree path of the doc containing the embed
   * @param {string} target - Embed target as written in the doc
   * @param {{literal?: boolean}} [options] - literal: don't strip "#"/"|" suffixes
   * @returns {Promise<string>}
   */
  function getEmbedUrl(from, target, { literal = false } = {}) {
    if (disposed) return Promise.reject(abortError());
    const key = `${literal ? 1 : 0}\u0000${from}\u0000${target}`;
    const existing = embedEntries.get(key);
    if (existing) return existing;

    const promise = schedule(async () => {
      const blob = await fetchEmbed(from, target, {
        literal: !!literal,
        signal: controller.signal,
      });
      if (disposed) throw abortError();
      const { url, revoke } = await blobToDisplayUrl(
        blob,
        embedExtension(target, literal),
      );
      if (disposed) {
        revoke();
        throw abortError();
      }
      revokers.add(revoke);
      return url;
    });
    return remember(embedEntries, key, promise);
  }

  /**
   * Returns the text of a doc (for note embeds and canvas file nodes).
   * @param {string} path - Tree path
   * @returns {Promise<string>}
   */
  function getText(path) {
    if (disposed) return Promise.reject(abortError());
    const existing = textEntries.get(path);
    if (existing) return existing;

    const promise = schedule(async () => {
      const text = await fetchText(path, { signal: controller.signal });
      if (disposed) throw abortError();
      return text;
    });
    return remember(textEntries, path, promise);
  }

  /**
   * Aborts in-flight fetches, rejects running and queued work, and revokes every URL.
   * Running jobs are rejected right away, even if a fetch ignores its signal.
   */
  function dispose() {
    if (disposed) return;
    disposed = true;
    controller.abort();
    for (const job of running) job.reject(abortError());
    for (const job of queue.splice(0)) job.reject(abortError());
    for (const revoke of revokers) {
      try {
        revoke();
      } catch {
        // Already revoked
      }
    }
    revokers.clear();
    embedEntries.clear();
    textEntries.clear();
  }

  return { getEmbedUrl, getText, dispose };
}

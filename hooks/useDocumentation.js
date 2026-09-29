import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  fetchDocsTree,
  fetchDocsFile,
  fetchDocsRawBlob,
  fetchDocsEmbedBlob,
  refreshDocsTree,
} from "@/src/lib/docsService";
import { buildDocsIndex } from "@/src/lib/obsidian";
import { createDocsResourceCache } from "@/src/lib/docsResourceCache";
import {
  getFileKind,
  getExtension,
  blobToDisplayUrl,
} from "@/src/lib/fileTypes";

/** Kinds loaded as text through /docs/file */
const TEXT_KINDS = new Set(["markdown", "canvas"]);

/** Kinds loaded as a Blob through /docs/raw */
const BINARY_KINDS = new Set(["pdf", "image"]);

/** Whether an error came from aborting a request */
function isAbortError(err) {
  return !!err && err.name === "AbortError";
}

/**
 * Whether the open doc failed to load (so selecting it again, or refreshing,
 * should load it again). Unsupported types are not retried: nothing is fetched.
 * @param {object|null} doc - The open doc
 * @param {string} [path] - Path being selected; omit to ask about any path
 */
function isFailedLoad(doc, path) {
  if (!doc || !doc.error) return false;
  if (path !== undefined && doc.path !== path) return false;
  return TEXT_KINDS.has(doc.kind) || BINARY_KINDS.has(doc.kind);
}

/**
 * Custom hook for documentation browsing.
 * Fetches the file tree on mount and loads the selected document.
 *
 * The open document is one atomic object, so its path, kind and content always
 * belong together:
 *   { path, kind, text }                 markdown / canvas
 *   { path, kind, blob, displayUrl }     pdf / image
 *   { path, kind, error }                failed or unsupported
 * plus `cache`, the per-document resource cache (embedded images, PDFs and
 * note texts). The cache and the display URL live exactly as long as the load
 * effect for that document: its cleanup aborts the fetch, disposes the cache
 * (revoking every embed URL) and revokes the display URL.
 *
 * `doc` is only returned once it matches `selectedPath`; while the next document
 * loads it is null, so views holding revoked URLs are never shown.
 */
export function useDocumentation() {
  const [tree, setTree] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  // Bumped to load the selected doc again (retry after a failed load)
  const [reloadCount, setReloadCount] = useState(0);
  const [loadedDoc, setLoadedDoc] = useState(null);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  const mountedRef = useRef(false);
  const refreshingRef = useRef(false);
  const docRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lookup index used to resolve [[links]] and embeds against the tree
  const index = useMemo(() => buildDocsIndex(tree), [tree]);

  // Fetch tree on mount
  useEffect(() => {
    let cancelled = false;

    async function loadTree() {
      setIsTreeLoading(true);
      setTreeError(null);
      try {
        const data = await fetchDocsTree();
        if (!cancelled) setTree(data);
      } catch (err) {
        if (!cancelled)
          setTreeError(err.message || "Failed to load documentation tree");
      } finally {
        if (!cancelled) setIsTreeLoading(false);
      }
    }

    loadTree();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the selected document (text, or a Blob + display URL)
  useEffect(() => {
    if (!selectedPath) {
      setLoadedDoc(null);
      return undefined;
    }

    const path = selectedPath;
    const kind = getFileKind(path);
    const controller = new AbortController();
    const { signal } = controller;
    // Created here (not in render) so StrictMode's double mount gets a fresh one
    const cache = createDocsResourceCache({
      fetchEmbed: fetchDocsEmbedBlob,
      fetchText: fetchDocsFile,
    });
    let revokeDisplayUrl = null;

    async function load() {
      try {
        if (TEXT_KINDS.has(kind)) {
          const text = await fetchDocsFile(path, { signal });
          if (signal.aborted) return;
          setLoadedDoc({ path, kind, text, cache, error: null });
        } else if (BINARY_KINDS.has(kind)) {
          const blob = await fetchDocsRawBlob(path, { signal });
          if (signal.aborted) return;
          const display = await blobToDisplayUrl(blob, getExtension(path));
          if (signal.aborted) {
            display.revoke();
            return;
          }
          revokeDisplayUrl = display.revoke;
          setLoadedDoc({
            path,
            kind,
            blob,
            displayUrl: display.url,
            cache,
            error: null,
          });
        } else {
          setLoadedDoc({
            path,
            kind,
            cache,
            error: "This file type can't be previewed.",
          });
        }
      } catch (err) {
        if (signal.aborted || isAbortError(err)) return;
        setLoadedDoc({
          path,
          kind,
          cache,
          error: err?.message || "Failed to load document",
        });
      }
    }

    load();
    return () => {
      controller.abort();
      cache.dispose();
      if (revokeDisplayUrl) revokeDisplayUrl();
      // Forget this load's doc: its cache and URL are gone now. Without this,
      // switching A -> B -> A quickly would briefly show A with revoked URLs.
      setLoadedDoc((prev) => (prev && prev.cache === cache ? null : prev));
    };
  }, [selectedPath, reloadCount]);

  const doc = loadedDoc && loadedDoc.path === selectedPath ? loadedDoc : null;

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  const selectFile = useCallback((path) => {
    if (typeof path !== "string" || !path) return;
    // Selecting the open doc again retries it if it failed (the path itself
    // doesn't change, so the load effect wouldn't run on its own)
    if (isFailedLoad(docRef.current, path)) setReloadCount((n) => n + 1);
    setSelectedPath(path);
  }, []);

  /**
   * Asks the backend to rescan the vaults and swaps in the fresh tree.
   * Uses its own isRefreshing flag (not isTreeLoading), so the sidebar stays
   * mounted; failures are reported in refreshError and the old tree is kept.
   * An open markdown/canvas doc is re-fetched too and updated if it changed; an
   * open doc that failed to load is loaded again.
   */
  const refreshTree = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const data = await refreshDocsTree();
      if (!mountedRef.current) return;
      if (data) {
        setTree(data);
        setTreeError(null);
      }

      const current = docRef.current;
      if (isFailedLoad(current)) {
        setReloadCount((n) => n + 1);
      } else if (current && !current.error && TEXT_KINDS.has(current.kind)) {
        try {
          const text = await fetchDocsFile(current.path);
          if (!mountedRef.current || text === current.text) return;
          setLoadedDoc((prev) =>
            prev && prev.cache === current.cache ? { ...prev, text } : prev,
          );
        } catch {
          // Keep showing the loaded version; the tree refresh itself succeeded
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setRefreshError(err?.message || "Failed to refresh documentation");
      }
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) setIsRefreshing(false);
    }
  }, []);

  const dismissRefreshError = useCallback(() => setRefreshError(null), []);

  return {
    tree,
    index,
    selectedPath,
    doc,
    isTreeLoading,
    treeError,
    isRefreshing,
    refreshError,
    selectFile,
    refreshTree,
    dismissRefreshError,
  };
}

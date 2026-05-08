import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchDocsTree, fetchDocsFile } from "@/src/lib/docsService";

/**
 * Recursively builds a lookup map from file display names to their full paths.
 * Maps both the full filename ("Getting Started.md") and the name without
 * extension ("Getting Started") to the path, so Obsidian [[links]] resolve.
 */
function buildFileLookup(node, map = {}) {
  if (!node) return map;

  if (node.type === "file" && node.path) {
    // Map full name → path  (e.g. "Getting Started.md" → "guides/Getting Started.md")
    const name = node.name.toLowerCase();
    map[name] = node.path;

    // Map name without .md extension → path
    const nameNoExt = name.replace(/\.md$/, "");
    map[nameNoExt] = node.path;
  }

  if (node.children) {
    node.children.forEach((child) => buildFileLookup(child, map));
  }

  return map;
}

/**
 * Custom hook for documentation browsing.
 * Fetches the file tree on mount and loads file content when a path is selected.
 */
export function useDocumentation() {
  const [tree, setTree] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);
  const [content, setContent] = useState(null);
  const [isTreeLoading, setIsTreeLoading] = useState(true);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [treeError, setTreeError] = useState(null);
  const [contentError, setContentError] = useState(null);

  // Build a name→path lookup map whenever the tree changes
  const fileLookup = useMemo(() => {
    if (!tree) return {};
    return buildFileLookup(tree);
  }, [tree]);

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

  // Fetch file content when selectedPath changes
  useEffect(() => {
    if (!selectedPath) {
      setContent(null);
      setContentError(null);
      return;
    }

    let cancelled = false;

    async function loadFile() {
      setIsContentLoading(true);
      setContentError(null);
      setContent(null);
      try {
        const markdown = await fetchDocsFile(selectedPath);
        if (!cancelled) setContent(markdown);
      } catch (err) {
        if (!cancelled)
          setContentError(err.message || "Failed to load document");
      } finally {
        if (!cancelled) setIsContentLoading(false);
      }
    }

    loadFile();
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  const selectFile = useCallback((path) => {
    setSelectedPath(path);
  }, []);

  /**
   * Resolves an Obsidian-style link name to a file path in the tree.
   * @param {string} linkName - The text inside [[brackets]]
   * @returns {string|null} The file path, or null if not found
   */
  const resolveLink = useCallback(
    (linkName) => {
      const key = linkName.trim().toLowerCase();
      return fileLookup[key] || fileLookup[key + ".md"] || null;
    },
    [fileLookup],
  );

  return {
    tree,
    selectedPath,
    content,
    isTreeLoading,
    isContentLoading,
    treeError,
    contentError,
    selectFile,
    resolveLink,
    fileLookup,
  };
}

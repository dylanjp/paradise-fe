"use client";

import { useMemo, useCallback, useRef, useEffect } from "react";
import { marked } from "marked";
import BlogAnimator from "./BlogAnimator";
import styles from "./DocsContent.module.css";

marked.setOptions({ breaks: true, gfm: true });

/**
 * Converts Obsidian-style [[Link]] syntax into clickable anchor tags.
 * The anchors use data-doc-link attributes so we can intercept clicks.
 */
function convertObsidianLinks(markdown, fileLookup) {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (match, inner) => {
    const linkText = inner.trim();
    if (!linkText) return match;

    const key = linkText.toLowerCase();
    const resolvedPath =
      fileLookup[key] || fileLookup[key.replace(/\.md$/, "")] || null;

    if (resolvedPath) {
      return `<a href="#" class="docs-internal-link" data-doc-link="${resolvedPath}">${linkText}</a>`;
    }
    // No match found — render as plain styled text
    return `<span class="docs-unresolved-link">${linkText}</span>`;
  });
}

/**
 * DocsContent - Renders markdown documentation content with decode animation.
 * Supports Obsidian [[link]] syntax for navigating between documents.
 *
 * @param {string|null} content - Raw markdown string
 * @param {boolean} isLoading - Whether content is being fetched
 * @param {string|null} error - Error message if fetch failed
 * @param {string|null} selectedPath - Currently selected file path
 * @param {function} onSelectFile - Callback to navigate to a linked document
 * @param {object} fileLookup - Map of lowercase file names to paths
 */
export default function DocsContent({
  content,
  isLoading,
  error,
  selectedPath,
  onSelectFile,
  fileLookup = {},
}) {
  const contentRef = useRef(null);

  const htmlContent = useMemo(() => {
    if (!content) return null;
    const processed = convertObsidianLinks(content, fileLookup);
    return marked.parse(processed);
  }, [content, fileLookup]);

  // Intercept clicks on Obsidian-style internal links
  const handleContentClick = useCallback(
    (e) => {
      const link = e.target.closest("[data-doc-link]");
      if (link) {
        e.preventDefault();
        const docPath = link.getAttribute("data-doc-link");
        if (docPath && onSelectFile) {
          onSelectFile(docPath);
        }
      }
    },
    [onSelectFile],
  );

  // Scroll to top when a new file is selected
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [selectedPath]);

  // Empty state - no file selected
  if (!selectedPath) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#9776;</div>
          <p className={styles.emptyText}>SELECT A DOCUMENT FROM THE SIDEBAR</p>
          <p className={styles.emptySubtext}>
            Browse the file tree to view documentation
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.loadingState}>
          <span className={styles.loadingText}>DECRYPTING FILE...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.contentArea} ref={contentRef}>
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>ACCESS DENIED</p>
          <p className={styles.errorMessage}>{error}</p>
        </div>
      </div>
    );
  }

  // Render markdown content with decode animation
  return (
    <div
      className={styles.contentArea}
      ref={contentRef}
      onClick={handleContentClick}
    >
      <main className={styles.markdownContainer}>
        <BlogAnimator
          key={selectedPath}
          htmlContent={htmlContent}
          enableAnimation={true}
        />
      </main>
    </div>
  );
}

"use client";

import { FaBars, FaTimes, FaSyncAlt } from "react-icons/fa";
import DocsTreeNode from "./DocsTreeNode";
import styles from "./DocsSidebar.module.css";

/**
 * DocsSidebar - Sidebar containing the documentation file tree.
 * Always visible on desktop, slide-in overlay on mobile.
 * The header has a refresh button that asks the backend to rescan the vaults;
 * a failed refresh is shown under the header and the current tree is kept.
 *
 * @param {object} tree - Root tree node from /docs/tree
 * @param {string} selectedPath - Currently selected file path
 * @param {function} onSelectFile - Callback when a file is clicked
 * @param {boolean} isOpen - Whether the sidebar is open (mobile)
 * @param {function} onToggle - Toggle sidebar open/closed
 * @param {function} onRefresh - Rescan the documentation roots
 * @param {boolean} isRefreshing - Whether a refresh is running
 * @param {string|null} refreshError - Message from the last failed refresh
 * @param {function} onDismissRefreshError - Hide the refresh error
 */
export default function DocsSidebar({
  tree,
  selectedPath,
  onSelectFile,
  isOpen,
  onToggle,
  onRefresh,
  isRefreshing = false,
  refreshError = null,
  onDismissRefreshError,
}) {
  const hasChildren = tree && tree.children && tree.children.length > 0;

  const handleFileSelect = (path) => {
    onSelectFile(path);
    // Auto-close sidebar on mobile after selection
    if (window.innerWidth <= 768) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className={styles.mobileToggle}
        onClick={onToggle}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        type="button"
      >
        {isOpen ? <FaTimes /> : <FaBars />}
      </button>

      {/* Backdrop for mobile overlay */}
      {isOpen && (
        <div
          className={styles.backdrop}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}
        aria-label="Documentation navigation"
      >
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>FILE SYSTEM</h3>
          {onRefresh && (
            <button
              type="button"
              className={styles.refreshButton}
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={
                isRefreshing
                  ? "Refreshing documentation"
                  : "Refresh documentation"
              }
              aria-busy={isRefreshing}
              title={isRefreshing ? "Refreshing..." : "Refresh documentation"}
            >
              <FaSyncAlt
                className={isRefreshing ? styles.spinning : undefined}
                aria-hidden="true"
              />
            </button>
          )}
        </div>

        {refreshError && (
          <div className={styles.refreshError} role="alert">
            <span className={styles.refreshErrorText}>
              REFRESH FAILED: {refreshError}
            </span>
            {onDismissRefreshError && (
              <button
                type="button"
                className={styles.dismissButton}
                onClick={onDismissRefreshError}
                aria-label="Dismiss refresh error"
              >
                <FaTimes aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        <div className={styles.treeContainer} role="tree">
          {!hasChildren ? (
            <div className={styles.emptyTree}>No documentation available</div>
          ) : (
            tree.children.map((node) => (
              <DocsTreeNode
                key={node.path}
                node={node}
                selectedPath={selectedPath}
                onSelectFile={handleFileSelect}
                depth={0}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}

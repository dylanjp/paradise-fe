"use client";

import { FaBars, FaTimes } from "react-icons/fa";
import DocsTreeNode from "./DocsTreeNode";
import styles from "./DocsSidebar.module.css";

/**
 * DocsSidebar - Sidebar containing the documentation file tree.
 * Always visible on desktop, slide-in overlay on mobile.
 *
 * @param {object} tree - Root tree node from /docs/tree
 * @param {string} selectedPath - Currently selected file path
 * @param {function} onSelectFile - Callback when a file is clicked
 * @param {boolean} isOpen - Whether the sidebar is open (mobile)
 * @param {function} onToggle - Toggle sidebar open/closed
 */
export default function DocsSidebar({
  tree,
  selectedPath,
  onSelectFile,
  isOpen,
  onToggle,
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
        role="tree"
        aria-label="Documentation navigation"
      >
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>FILE SYSTEM</h3>
        </div>

        <div className={styles.treeContainer}>
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

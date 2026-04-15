"use client";

import { useState } from "react";
import {
  FaChevronRight,
  FaChevronDown,
  FaFolder,
  FaFolderOpen,
  FaFileAlt,
} from "react-icons/fa";
import styles from "./DocsTreeNode.module.css";

/**
 * DocsTreeNode - Recursive tree node for documentation file/folder navigation.
 *
 * @param {object} node - Tree node with { name, type, path, children }
 * @param {string} selectedPath - Currently selected file path
 * @param {function} onSelectFile - Callback when a file is clicked
 * @param {number} depth - Nesting depth for indentation
 */
export default function DocsTreeNode({ node, selectedPath, onSelectFile, depth = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isFolder = node.type === "folder";
  const isSelected = !isFolder && node.path === selectedPath;

  const handleClick = () => {
    if (isFolder) {
      setIsExpanded((prev) => !prev);
    } else {
      onSelectFile(node.path);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  // Strip .md extension for display
  const displayName = isFolder
    ? node.name
    : node.name.replace(/\.md$/, "");

  return (
    <div className={styles.nodeContainer}>
      <div
        className={`${styles.nodeRow} ${isSelected ? styles.selected : ""}`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isSelected || undefined}
      >
        {isFolder ? (
          <>
            <span className={styles.chevron}>
              {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
            </span>
            <span className={styles.icon}>
              {isExpanded ? <FaFolderOpen /> : <FaFolder />}
            </span>
          </>
        ) : (
          <>
            <span className={styles.chevronSpacer} />
            <span className={styles.icon}>
              <FaFileAlt />
            </span>
          </>
        )}
        <span className={styles.nodeName}>{displayName}</span>
      </div>

      {isFolder && isExpanded && node.children && (
        <div className={styles.childrenContainer} role="group">
          {node.children.map((child) => (
            <DocsTreeNode
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

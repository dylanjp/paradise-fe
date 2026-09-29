"use client";

import { useState, useEffect, useRef } from "react";
import {
  FaChevronRight,
  FaChevronDown,
  FaFolder,
  FaFolderOpen,
  FaBook,
  FaBookOpen,
  FaFile,
  FaFileAlt,
  FaFileImage,
  FaFilePdf,
  FaProjectDiagram,
} from "react-icons/fa";
import { getFileKind } from "@/src/lib/fileTypes";
import styles from "./DocsTreeNode.module.css";

/** Icon per file kind */
const FILE_ICONS = {
  markdown: FaFileAlt,
  canvas: FaProjectDiagram,
  pdf: FaFilePdf,
  image: FaFileImage,
};

/**
 * DocsTreeNode - Recursive tree node for documentation file/folder navigation.
 * Vault roots (node.root, e.g. "LE Docs") get a book icon. A folder expands by
 * itself when the selected file lies inside it (e.g. after following a link).
 *
 * @param {object} node - Tree node with { name, type, path, children, root? }
 * @param {string} selectedPath - Currently selected file path
 * @param {function} onSelectFile - Callback when a file is clicked
 * @param {number} depth - Nesting depth for indentation
 */
export default function DocsTreeNode({
  node,
  selectedPath,
  onSelectFile,
  depth = 0,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const rowRef = useRef(null);
  const isFolder = node.type === "folder";
  const isRoot = isFolder && node.root === true;
  const isSelected = !isFolder && node.path === selectedPath;
  const containsSelection =
    isFolder &&
    !!node.path &&
    typeof selectedPath === "string" &&
    selectedPath.startsWith(`${node.path}/`);

  // Reveal the selected file: expand every folder on its path
  useEffect(() => {
    if (containsSelection) setIsExpanded(true);
  }, [containsSelection, selectedPath]);

  // Keep the selected row visible in the (scrolling) tree
  useEffect(() => {
    const row = rowRef.current;
    if (isSelected && row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

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

  // Strip .md / .canvas extensions for display
  const displayName = isFolder
    ? node.name
    : node.name.replace(/\.(md|canvas)$/i, "");

  let icon;
  if (isFolder) {
    if (isRoot) icon = isExpanded ? <FaBookOpen /> : <FaBook />;
    else icon = isExpanded ? <FaFolderOpen /> : <FaFolder />;
  } else {
    const FileIcon = FILE_ICONS[getFileKind(node.name)] || FaFile;
    icon = <FileIcon />;
  }

  return (
    <div className={styles.nodeContainer}>
      <div
        ref={rowRef}
        className={`${styles.nodeRow} ${isSelected ? styles.selected : ""} ${
          isRoot ? styles.rootRow : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-selected={isSelected || undefined}
        title={node.name}
      >
        {isFolder ? (
          <span className={styles.chevron}>
            {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
          </span>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <span className={`${styles.icon} ${isRoot ? styles.rootIcon : ""}`}>
          {icon}
        </span>
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

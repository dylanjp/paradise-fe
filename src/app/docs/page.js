"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import DocsSidebar from "@/components/DocsSidebar";
import DocsContent from "@/components/DocsContent";
import RouteGuard from "@/components/RouteGuard";
import { useDocumentation } from "@/hooks/useDocumentation";
import styles from "./docs.module.css";

export default function DocsPage() {
  const {
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
  } = useDocumentation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <RouteGuard>
      <div className={styles.page}>
        <div className={styles.pageBackground}>
          <Background />
        </div>
        <Navbar />

        <div className={styles.docsLayout}>
          {isTreeLoading ? (
            <aside className={styles.sidebarLoading}>
              <span className={styles.sidebarLoadingText}>LOADING TREE...</span>
            </aside>
          ) : treeError && !tree ? (
            <aside className={styles.sidebarError}>
              <span className={styles.sidebarErrorText}>{treeError}</span>
              <button
                type="button"
                className={styles.retryButton}
                onClick={refreshTree}
                disabled={isRefreshing}
              >
                {isRefreshing ? "RETRYING..." : "RETRY"}
              </button>
              {refreshError && (
                <span className={styles.sidebarErrorText}>{refreshError}</span>
              )}
            </aside>
          ) : (
            <DocsSidebar
              tree={tree}
              selectedPath={selectedPath}
              onSelectFile={selectFile}
              isOpen={isSidebarOpen}
              onToggle={toggleSidebar}
              onRefresh={refreshTree}
              isRefreshing={isRefreshing}
              refreshError={refreshError}
              onDismissRefreshError={dismissRefreshError}
            />
          )}

          <DocsContent
            doc={doc}
            selectedPath={selectedPath}
            index={index}
            onSelectFile={selectFile}
          />
        </div>
      </div>
    </RouteGuard>
  );
}

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
    selectedPath,
    content,
    isTreeLoading,
    isContentLoading,
    treeError,
    contentError,
    selectFile,
    fileLookup,
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
              <span className={styles.sidebarLoadingText}>
                LOADING TREE...
              </span>
            </aside>
          ) : treeError ? (
            <aside className={styles.sidebarError}>
              <span className={styles.sidebarErrorText}>{treeError}</span>
            </aside>
          ) : (
            <DocsSidebar
              tree={tree}
              selectedPath={selectedPath}
              onSelectFile={selectFile}
              isOpen={isSidebarOpen}
              onToggle={toggleSidebar}
            />
          )}

          <DocsContent
            content={content}
            isLoading={isContentLoading}
            error={contentError}
            selectedPath={selectedPath}
            onSelectFile={selectFile}
            fileLookup={fileLookup}
          />
        </div>
      </div>
    </RouteGuard>
  );
}

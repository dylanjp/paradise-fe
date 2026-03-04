"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/components/Navbar";
import Background from "@/components/Background";
import DriveToolbar from "@/components/DriveToolbar";
import DriveToggle from "@/components/DriveToggle";
import BreadcrumbBar from "@/components/BreadcrumbBar";
import FileGrid from "@/components/FileGrid";
import DriveContextMenu from "@/components/DriveContextMenu";
import ColorPicker from "@/components/ColorPicker";
import PlexUploadModal from "@/components/PlexUploadModal";
import ConfirmModal from "@/components/ConfirmModal";
import * as driveService from "@/src/lib/driveService";
import { buildBreadcrumbPath, collectDescendants } from "@/src/lib/driveUtils";
import { useAuth } from "@/src/context/AuthContext";
import styles from "./drive.module.css";

const DRIVE_LABELS = {
  myDrive: "My Drive",
  sharedDrive: "Shared Drive",
  adminDrive: "Admin Drive",
  mediaCache: "Media Cache",
};

export default function DrivePage() {
  const { isAdmin, isLoading: authLoading, username } = useAuth();
  const [driveData, setDriveData] = useState(null);
  const [activeDrive, setActiveDrive] = useState("myDrive");
  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [breadcrumbPath, setBreadcrumbPath] = useState([
    { id: "root", name: "My Drive" },
  ]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [plexModalOpen, setPlexModalOpen] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragSourceId, setDragSourceId] = useState(null);
  const [moveConfirm, setMoveConfirm] = useState(null);
  const [breadcrumbDragOverId, setBreadcrumbDragOverId] = useState(null);
  const [moveMode, setMoveMode] = useState(null); // { itemId, itemName } when move mode is active
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isMediaCache = activeDrive === "mediaCache";

  const colorPickerTransition = useRef(false);

  // Fetch drive contents on mount and when activeDrive changes
  useEffect(() => {
    if (authLoading || !username) return;
    let cancelled = false;
    async function fetchDrive() {
      setLoading(true);
      setError(null);
      try {
        const data = await driveService.listDriveContents(
          username,
          activeDrive,
        );
        if (!cancelled) {
          setDriveData(data);
          setCurrentFolderId("root");
          if (data["root"]) {
            setBreadcrumbPath([{ id: "root", name: data["root"].name }]);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(driveService.getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    fetchDrive();
    return () => {
      cancelled = true;
    };
  }, [activeDrive, authLoading, username]);

  // Re-fetch current drive contents (used on DRIVE_ITEM_NOT_FOUND)
  async function refreshDriveContents() {
    try {
      const data = await driveService.listDriveContents(username, activeDrive);
      setDriveData(data);
    } catch {
      /* refresh is best-effort */
    }
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setShowColorPicker(false);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu && !colorPickerTransition.current) {
        closeContextMenu();
      }
      colorPickerTransition.current = false;
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu, closeContextMenu]);

  function navigateToFolder(folderId) {
    const targetId = driveData[folderId] ? folderId : "root";
    setCurrentFolderId(targetId);
    setBreadcrumbPath(buildBreadcrumbPath(driveData, targetId));
    closeContextMenu();
    setNewFolderMode(false);
  }

  function switchDrive(driveKey) {
    setActiveDrive(driveKey);
    closeContextMenu();
    setNewFolderMode(false);
  }

  async function createFolder(name) {
    setError(null);
    try {
      const newItem = await driveService.createFolder(
        username,
        activeDrive,
        name,
        currentFolderId,
      );
      setDriveData((prev) => {
        const updated = { ...prev };
        updated[newItem.id] = newItem;
        updated[currentFolderId] = {
          ...updated[currentFolderId],
          children: [...updated[currentFolderId].children, newItem.id],
        };
        return updated;
      });
    } catch (err) {
      setError(driveService.getErrorMessage(err));
      if (driveService.getErrorCode(err) === "DRIVE_ITEM_NOT_FOUND") {
        await refreshDriveContents();
      }
    }
    setNewFolderMode(false);
  }

  function handleFileUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      for (const file of files) {
        try {
          const newItem = await driveService.uploadFile(
            username,
            activeDrive,
            file,
            currentFolderId,
            (pct) => {
              setUploadProgress(pct);
            },
          );
          setDriveData((prev) => {
            const updated = { ...prev };
            updated[newItem.id] = newItem;
            updated[currentFolderId] = {
              ...updated[currentFolderId],
              children: [...updated[currentFolderId].children, newItem.id],
            };
            return updated;
          });
        } catch (err) {
          setError(
            `Failed to upload "${file.name}": ${driveService.getErrorMessage(err)}`,
          );
          if (driveService.getErrorCode(err) === "DRIVE_ITEM_NOT_FOUND") {
            await refreshDriveContents();
          }
        }
      }
      setUploading(false);
    };
    input.click();
  }

  async function changeFolderColor(folderId, color) {
    const snapshot = driveData[folderId];
    // Optimistic update
    setDriveData((prev) => ({
      ...prev,
      [folderId]: { ...prev[folderId], color },
    }));
    closeContextMenu();
    try {
      const updated = await driveService.updateItem(
        username,
        activeDrive,
        folderId,
        { color },
      );
      setDriveData((prev) => ({
        ...prev,
        [folderId]: updated,
      }));
    } catch (err) {
      // Rollback
      setDriveData((prev) => ({
        ...prev,
        [folderId]: snapshot,
      }));
      setError(driveService.getErrorMessage(err));
      if (driveService.getErrorCode(err) === "DRIVE_ITEM_NOT_FOUND") {
        await refreshDriveContents();
      }
    }
  }

  function getCurrentItems() {
    const currentFolder = driveData[currentFolderId];
    if (!currentFolder) return [];
    return currentFolder.children
      .map((childId) => driveData[childId])
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return 0;
      });
  }

  function handleContextMenu(event, itemId) {
    event.preventDefault();
    event.stopPropagation();
    if (isMediaCache) return;
    if (!driveData[itemId]) return;
    setContextMenu({ x: event.clientX, y: event.clientY, itemId });
    setShowColorPicker(false);
  }

  async function handleFileDownload(itemId) {
    const item = driveData[itemId];
    if (!item || item.type !== "file") return;
    setError(null);
    try {
      const blob = await driveService.downloadFile(
        username,
        activeDrive,
        itemId,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = item.name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(driveService.getErrorMessage(err));
      if (driveService.getErrorCode(err) === "DRIVE_ITEM_NOT_FOUND") {
        await refreshDriveContents();
      }
    }
  }

  function deleteItem(itemId) {
    const item = driveData[itemId];
    if (!item) return;
    setDeleteConfirm({ itemId, itemName: item.name });
    closeContextMenu();
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    const { itemId } = deleteConfirm;
    const item = driveData[itemId];
    if (!item) {
      setDeleteConfirm(null);
      return;
    }

    const parentId = item.parentId;
    const idsToRemove = collectDescendants(driveData, itemId);

    // Snapshot for rollback
    const snapshot = { ...driveData };

    // If user is inside the deleted folder, navigate to parent
    if (idsToRemove.includes(currentFolderId)) {
      const targetParent = parentId || "root";
      setCurrentFolderId(targetParent);
      const updatedDrive = { ...driveData };
      idsToRemove.forEach((id) => delete updatedDrive[id]);
      if (parentId && updatedDrive[parentId]) {
        updatedDrive[parentId] = {
          ...updatedDrive[parentId],
          children: updatedDrive[parentId].children.filter(
            (cid) => cid !== itemId,
          ),
        };
      }
      setBreadcrumbPath(buildBreadcrumbPath(updatedDrive, targetParent));
    }

    // Optimistic removal
    setDriveData((prev) => {
      const updated = { ...prev };
      if (parentId && updated[parentId]) {
        updated[parentId] = {
          ...updated[parentId],
          children: updated[parentId].children.filter((cid) => cid !== itemId),
        };
      }
      idsToRemove.forEach((id) => delete updated[id]);
      return updated;
    });

    setDeleteConfirm(null);

    try {
      await driveService.deleteItem(username, activeDrive, itemId);
    } catch (err) {
      // Rollback
      setDriveData(snapshot);
      if (idsToRemove.includes(currentFolderId)) {
        setCurrentFolderId(currentFolderId);
        setBreadcrumbPath(buildBreadcrumbPath(snapshot, currentFolderId));
      }
      setError(driveService.getErrorMessage(err));
      if (driveService.getErrorCode(err) === "DRIVE_ITEM_NOT_FOUND") {
        await refreshDriveContents();
      }
    }
  }

  function cancelDelete() {
    setDeleteConfirm(null);
  }

  function handleDragStart(e, itemId) {
    const item = driveData[itemId];
    if (!item) return;
    setDragSourceId(itemId);
    e.dataTransfer.setData("text/plain", itemId);
    e.dataTransfer.setData("application/x-item-name", item.name);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragSourceId(null);
  }

  function handleDropOnFolder(destinationId) {
    if (!dragSourceId || !driveData[dragSourceId]) return;
    const dest = driveData[destinationId];
    if (!dest || dest.type !== "folder" || destinationId === dragSourceId) return;
    setMoveConfirm({
      itemId: dragSourceId,
      itemName: driveData[dragSourceId].name,
      destinationId,
      destinationName: dest.name,
    });
  }

  function handleDropOnBreadcrumb(segmentId, segmentName) {
    if (!dragSourceId || !driveData[dragSourceId]) return;
    if (segmentId === currentFolderId) return;
    setMoveConfirm({
      itemId: dragSourceId,
      itemName: driveData[dragSourceId].name,
      destinationId: segmentId,
      destinationName: segmentName,
    });
  }

  function cancelMove() {
    setMoveConfirm(null);
    setMoveMode(null);
    setDragSourceId(null);
  }

  function startMoveMode(itemId) {
    const item = driveData[itemId];
    if (!item) return;
    setMoveMode({ itemId, itemName: item.name });
    setDragSourceId(itemId);
    closeContextMenu();
  }

  function handleMoveTarget(destinationId, destinationName) {
    if (!moveMode) return;
    if (destinationId === moveMode.itemId) return;
    if (destinationId === currentFolderId) return;
    const dest = driveData[destinationId];
    if (!dest || dest.type !== "folder") return;
    setMoveConfirm({
      itemId: moveMode.itemId,
      itemName: moveMode.itemName,
      destinationId,
      destinationName,
    });
    setMoveMode(null);
    setDragSourceId(null);
  }

  async function confirmMove() {
    if (!moveConfirm) return;
    const { itemId, destinationId } = moveConfirm;
    const item = driveData[itemId];
    if (!item) {
      setMoveConfirm(null);
      await refreshDriveContents();
      return;
    }
    const oldParentId = item.parentId;

    try {
      const newItem = await driveService.moveItem(
        username,
        activeDrive,
        itemId,
        destinationId,
      );

      setDriveData((prev) => {
        const updated = { ...prev };

        // Remove old item from old parent's children
        if (oldParentId && updated[oldParentId]) {
          updated[oldParentId] = {
            ...updated[oldParentId],
            children: updated[oldParentId].children.filter(
              (cid) => cid !== itemId,
            ),
          };
        }

        // Remove old item entry (and descendants if folder)
        const idsToRemove = collectDescendants(prev, itemId);
        idsToRemove.forEach((id) => delete updated[id]);

        // Add new item to destination folder's children
        if (updated[destinationId]) {
          updated[destinationId] = {
            ...updated[destinationId],
            children: [...updated[destinationId].children, newItem.id],
          };
        }

        // Set new item entry
        updated[newItem.id] = newItem;

        return updated;
      });

      // If current folder was inside the moved folder and no longer exists
      setDriveData((prev) => {
        if (!prev[currentFolderId]) {
          // Navigate to nearest valid ancestor
          const ancestors = buildBreadcrumbPath(prev, oldParentId || "root");
          const validAncestor =
            ancestors.length > 0 ? ancestors[ancestors.length - 1].id : "root";
          setCurrentFolderId(validAncestor);
          setBreadcrumbPath(buildBreadcrumbPath(prev, validAncestor));
        }
        return prev;
      });
    } catch (err) {
      const status = err?.status;
      if (status === 404) {
        setError("This item no longer exists.");
        await refreshDriveContents();
      } else if (status === 409) {
        setError(
          "An item with that name already exists in the destination folder, or the move would create a circular reference.",
        );
      } else if (status === 400) {
        setError("The root folder cannot be moved.");
      } else if (status === 403) {
        setError("You do not have permission to move this item.");
      } else {
        setError(driveService.getErrorMessage(err));
      }
    }

    setMoveConfirm(null);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageBackground}>
        <Background />
      </div>
      <Navbar />
      <div className={styles.pageContent}>
        <h1 className={styles.title}>{DRIVE_LABELS[activeDrive]}</h1>
        <DriveToolbar
          onNewFolder={() => {
            if (!isMediaCache) setNewFolderMode(true);
          }}
          onUploadFile={handleFileUpload}
          onPlexUpload={() => setPlexModalOpen(true)}
          isMediaCache={isMediaCache}
        />
        <DriveToggle
          activeDrive={activeDrive}
          onDriveChange={switchDrive}
          showAdminDrive={isAdmin()}
        />
        <BreadcrumbBar
          path={breadcrumbPath}
          onNavigate={navigateToFolder}
          onSegmentDragOver={(e, segmentId) => setBreadcrumbDragOverId(segmentId)}
          onSegmentDragLeave={() => setBreadcrumbDragOverId(null)}
          onSegmentDrop={(e, segmentId, segmentName) => {
            setBreadcrumbDragOverId(null);
            handleDropOnBreadcrumb(segmentId, segmentName);
          }}
          dragOverSegmentId={breadcrumbDragOverId}
          isMediaCache={isMediaCache}
          moveMode={moveMode}
          onMoveTarget={handleMoveTarget}
        />
        {loading && (
          <p className={styles.loadingText}>Loading drive contents…</p>
        )}
        {error && <p className={styles.errorText}>{error}</p>}
        {moveMode && (
          <div className={styles.moveModeBar}>
            <span>Select a folder to move <strong>{moveMode.itemName}</strong> into</span>
            <button className={styles.moveModeCancelButton} onClick={cancelMove}>
              Cancel
            </button>
          </div>
        )}
        {!loading && driveData && (
          <FileGrid
            items={getCurrentItems()}
            onFolderClick={navigateToFolder}
            onFileClick={handleFileDownload}
            onContextMenu={handleContextMenu}
            newFolderMode={newFolderMode}
            onNewFolderSubmit={createFolder}
            onNewFolderCancel={() => setNewFolderMode(false)}
            isMediaCache={isMediaCache}
            dragSourceId={dragSourceId}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDropOnFolder={handleDropOnFolder}
            moveMode={moveMode}
            onMoveTarget={handleMoveTarget}
          />
        )}
        {uploading && (
          <div className={styles.uploadProgressContainer}>
            <div
              className={styles.uploadProgressBar}
              style={{ width: `${uploadProgress}%` }}
            />
            <span className={styles.uploadProgressText}>
              Uploading… {uploadProgress}%
            </span>
          </div>
        )}
        {contextMenu && !showColorPicker && (
          <DriveContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            itemType={driveData[contextMenu.itemId]?.type}
            onChangeColor={() => {
              colorPickerTransition.current = true;
              setShowColorPicker(true);
            }}
            onDelete={() => deleteItem(contextMenu.itemId)}
            onDownload={() => {
              handleFileDownload(contextMenu.itemId);
              closeContextMenu();
            }}
            onMove={() => startMoveMode(contextMenu.itemId)}
            onClose={closeContextMenu}
          />
        )}
        {contextMenu && showColorPicker && (
          <div
            style={{
              position: "absolute",
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 999,
            }}
          >
            <ColorPicker
              onSelectColor={(color) =>
                changeFolderColor(contextMenu.itemId, color)
              }
              onClose={closeContextMenu}
            />
          </div>
        )}
        <PlexUploadModal
          isOpen={plexModalOpen}
          onClose={() => setPlexModalOpen(false)}
          userId={username}
        />
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          itemName={deleteConfirm?.itemName || ""}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
        <ConfirmModal
          isOpen={moveConfirm !== null}
          onConfirm={confirmMove}
          onCancel={cancelMove}
          title="Confirm Move"
          message={
            moveConfirm
              ? `Are you sure you want to move ${moveConfirm.itemName} to ${moveConfirm.destinationName}?`
              : ""
          }
          confirmLabel="Yes"
        />
      </div>
    </div>
  );
}

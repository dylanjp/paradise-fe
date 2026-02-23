"use client";
import { useState, useEffect, useCallback } from "react";
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
import { myDriveData, sharedDriveData, adminDriveData } from "@/data/driveData";
import { buildBreadcrumbPath, generateId, getFileExtension, collectDescendants } from "@/src/lib/driveUtils";
import { useAuth } from "@/src/context/AuthContext";
import styles from "./drive.module.css";

const DRIVE_LABELS = {
  myDrive: "My Drive",
  sharedDrive: "Shared Drive",
  adminDrive: "Admin Drive",
};

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function DrivePage() {
  const { isAdmin } = useAuth();
  const [driveDataMap, setDriveDataMap] = useState({
    myDrive: myDriveData,
    sharedDrive: sharedDriveData,
    adminDrive: adminDriveData,
  });
  const [activeDrive, setActiveDrive] = useState("myDrive");
  const [currentFolderId, setCurrentFolderId] = useState("root");
  const [breadcrumbPath, setBreadcrumbPath] = useState([{ id: "root", name: "My Drive" }]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [plexModalOpen, setPlexModalOpen] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const driveData = driveDataMap[activeDrive];

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    setShowColorPicker(false);
  }, []);

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) closeContextMenu();
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
    setCurrentFolderId("root");
    const newDriveData = driveDataMap[driveKey];
    setBreadcrumbPath([{ id: "root", name: newDriveData["root"].name }]);
    closeContextMenu();
    setNewFolderMode(false);
  }

  function createFolder(name) {
    const id = generateId();
    const newFolder = {
      id,
      name,
      type: "folder",
      fileType: null,
      size: null,
      color: "#f80206",
      children: [],
      parentId: currentFolderId,
    };
    setDriveDataMap((prev) => {
      const currentDrive = { ...prev[activeDrive] };
      currentDrive[id] = newFolder;
      currentDrive[currentFolderId] = {
        ...currentDrive[currentFolderId],
        children: [...currentDrive[currentFolderId].children, id],
      };
      return { ...prev, [activeDrive]: currentDrive };
    });
    setNewFolderMode(false);
  }

  function handleFileUpload() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      setDriveDataMap((prev) => {
        const currentDrive = { ...prev[activeDrive] };
        const newChildIds = [];
        files.forEach((file) => {
          const id = generateId();
          const ext = getFileExtension(file.name);
          currentDrive[id] = {
            id,
            name: file.name,
            type: "file",
            fileType: ext || null,
            size: formatFileSize(file.size),
            color: null,
            children: [],
            parentId: currentFolderId,
          };
          newChildIds.push(id);
        });
        currentDrive[currentFolderId] = {
          ...currentDrive[currentFolderId],
          children: [...currentDrive[currentFolderId].children, ...newChildIds],
        };
        return { ...prev, [activeDrive]: currentDrive };
      });
    };
    input.click();
  }

  function changeFolderColor(folderId, color) {
    setDriveDataMap((prev) => {
      const currentDrive = { ...prev[activeDrive] };
      currentDrive[folderId] = { ...currentDrive[folderId], color };
      return { ...prev, [activeDrive]: currentDrive };
    });
    closeContextMenu();
  }

  function getCurrentItems() {
    const currentFolder = driveData[currentFolderId];
    if (!currentFolder) return [];
    return currentFolder.children
      .map((childId) => driveData[childId])
      .filter(Boolean);
  }

  function handleContextMenu(event, itemId) {
    event.preventDefault();
    event.stopPropagation();
    if (!driveData[itemId]) return;
    setContextMenu({ x: event.clientX, y: event.clientY, itemId });
    setShowColorPicker(false);
  }

  function deleteItem(itemId) {
    const item = driveData[itemId];
    if (!item) return;
    setDeleteConfirm({ itemId, itemName: item.name });
    closeContextMenu();
  }

  function confirmDelete() {
    if (!deleteConfirm) return;
    const { itemId } = deleteConfirm;
    const item = driveData[itemId];
    if (!item) {
      setDeleteConfirm(null);
      return;
    }

    const parentId = item.parentId;
    const idsToRemove = collectDescendants(driveData, itemId);

    // If user is inside the deleted folder, navigate to parent
    if (idsToRemove.includes(currentFolderId)) {
      const targetParent = parentId || "root";
      setCurrentFolderId(targetParent);
      // We need to rebuild breadcrumb after state update, so compute from current driveData
      const updatedDrive = { ...driveData };
      idsToRemove.forEach((id) => delete updatedDrive[id]);
      if (parentId && updatedDrive[parentId]) {
        updatedDrive[parentId] = {
          ...updatedDrive[parentId],
          children: updatedDrive[parentId].children.filter((cid) => cid !== itemId),
        };
      }
      setBreadcrumbPath(buildBreadcrumbPath(updatedDrive, targetParent));
    }

    setDriveDataMap((prev) => {
      const currentDrive = { ...prev[activeDrive] };
      // Remove item from parent's children
      if (parentId && currentDrive[parentId]) {
        currentDrive[parentId] = {
          ...currentDrive[parentId],
          children: currentDrive[parentId].children.filter((cid) => cid !== itemId),
        };
      }
      // Remove all descendant IDs
      idsToRemove.forEach((id) => delete currentDrive[id]);
      return { ...prev, [activeDrive]: currentDrive };
    });

    setDeleteConfirm(null);
  }

  function cancelDelete() {
    setDeleteConfirm(null);
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
          onNewFolder={() => setNewFolderMode(true)}
          onUploadFile={handleFileUpload}
          onPlexUpload={() => setPlexModalOpen(true)}
        />
        <DriveToggle
          activeDrive={activeDrive}
          onDriveChange={switchDrive}
          showAdminDrive={isAdmin()}
        />
        <BreadcrumbBar path={breadcrumbPath} onNavigate={navigateToFolder} />
        <FileGrid
          items={getCurrentItems()}
          onFolderClick={navigateToFolder}
          onContextMenu={handleContextMenu}
          newFolderMode={newFolderMode}
          onNewFolderSubmit={createFolder}
          onNewFolderCancel={() => setNewFolderMode(false)}
        />
        {contextMenu && !showColorPicker && (
          <DriveContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            itemType={driveData[contextMenu.itemId]?.type}
            onChangeColor={() => setShowColorPicker(true)}
            onDelete={() => deleteItem(contextMenu.itemId)}
            onClose={closeContextMenu}
          />
        )}
        {contextMenu && showColorPicker && (
          <ColorPicker
            onSelectColor={(color) => changeFolderColor(contextMenu.itemId, color)}
            onClose={closeContextMenu}
          />
        )}
        <PlexUploadModal
          isOpen={plexModalOpen}
          onClose={() => setPlexModalOpen(false)}
        />
        <ConfirmModal
          isOpen={deleteConfirm !== null}
          itemName={deleteConfirm?.itemName || ""}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      </div>
    </div>
  );
}

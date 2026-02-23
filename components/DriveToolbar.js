"use client";
import PrimaryButton from "./PrimaryButton";
import styles from "./DriveToolbar.module.css";

export default function DriveToolbar({ onNewFolder, onUploadFile, onPlexUpload }) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Drive actions">
      <div className={styles.leftGroup}>
        <PrimaryButton onClick={onNewFolder}>New Folder</PrimaryButton>
        <PrimaryButton onClick={onUploadFile}>Upload File</PrimaryButton>
      </div>
      <PrimaryButton onClick={onPlexUpload}>Upload Video to Plex</PrimaryButton>
    </div>
  );
}

"use client";
import React from "react";
import styles from "./DriveToggle.module.css";

const DRIVE_OPTIONS = [
  { key: "myDrive", label: "My Drive" },
  { key: "sharedDrive", label: "Shared Drive" },
  { key: "adminDrive", label: "Admin Drive" },
  { key: "mediaCache", label: "Media Cache" },
];

export default function DriveToggle({
  activeDrive = "myDrive",
  onDriveChange,
  showAdminDrive = false,
}) {
  const drives = showAdminDrive
    ? DRIVE_OPTIONS
    : DRIVE_OPTIONS.filter((d) => d.key !== "adminDrive");

  return (
    <div className={styles.toggleContainer}>
      {drives.map((drive) => (
        <button
          key={drive.key}
          type="button"
          className={`
            ${styles.toggleButton} 
            ${activeDrive === drive.key ? styles.active : styles.inactive}
          `.trim()}
          onClick={() => onDriveChange?.(drive.key)}
          aria-pressed={activeDrive === drive.key}
          disabled={activeDrive === drive.key}
        >
          {drive.label}
        </button>
      ))}
    </div>
  );
}

// components/VersionModal.js
"use client";

import { useEffect } from "react";
import versionData from "@/data/versionData";
import styles from "./VersionModal.module.css";

export default function VersionModal({ onClose }) {
  useEffect(() => {
    // Optional: logging or animations
  }, []);

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h2 className={styles.modalTitle}>Site Changelog</h2>
        <div className={styles.modalContent}>
          {versionData.map(({ version, releaseDate, notes }) => (
            <div key={version} className={styles.versionSection}>
              <h3 className={styles.versionTitle}>
                {version} <span className={styles.releaseDate}>({releaseDate})</span>
              </h3>
              <ul className={styles.noteList}>
                {notes.map((note, index) => (
                  <li key={index} className={styles.noteItem}>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className={styles.buttonRow}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// components/VersionModal.js
"use client";

import { useEffect } from "react";
import versionData from "@/data/versionData";
import styles from "./VersionModal.module.css";
import { useAuth } from "../src/context/AuthContext";
import { FaSignOutAlt, FaUserShield } from "react-icons/fa";
import Link from "next/link";

export default function VersionModal({ onClose }) {
  const { isAuthenticated, isAdmin, logout } = useAuth();

  useEffect(() => {
    // Optional: logging or animations
  }, []);

  const handleAdminClick = () => {
    onClose();
  };

  const handleLogoutClick = () => {
    logout();
    onClose();
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Site Changelog</h2>
          {isAuthenticated && (
            <div className={styles.authIconsContainer}>
              {isAdmin() && (
                <Link href="/admin" onClick={handleAdminClick} className={styles.authIcon} aria-label="Admin Panel">
                  <FaUserShield />
                </Link>
              )}
              <button onClick={handleLogoutClick} className={styles.authIcon} aria-label="Logout">
                <FaSignOutAlt />
              </button>
            </div>
          )}
        </div>
        <div className={styles.modalContent}>
          {versionData.map(({ version, releaseDate, notes }) => (
            <div key={version} className={styles.versionSection}>
              <h3 className={styles.versionTitle}>
                {version}{" "}
                <span className={styles.releaseDate}>({releaseDate})</span>
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

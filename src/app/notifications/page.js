"use client";

/**
 * Notification Reader Page
 * End-user facing page for viewing and interacting with personal notifications.
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import NotificationList from "@/components/NotificationList";
import { ToastProvider, useToast } from "@/components/ToastContainer";
import { useNotifications } from "@/hooks/useNotifications";
import styles from "./notifications.module.css";

function NotificationReaderContent() {
  const {
    notifications,
    isLoading,
    error,
    markAsRead,
    markAsUnread,
  } = useNotifications({ sortByUnread: true });

  const { showError } = useToast();

  const [loadingActionId, setLoadingActionId] = useState(undefined);
  const [loadingAction, setLoadingAction] = useState(null);

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const handleMarkRead = async (id) => {
    setLoadingActionId(id);
    setLoadingAction("markRead");
    try {
      await markAsRead(id);
    } catch {
      showError("Failed to mark notification as read");
    } finally {
      setLoadingActionId(undefined);
      setLoadingAction(null);
    }
  };

  const handleMarkUnread = async (id) => {
    setLoadingActionId(id);
    setLoadingAction("markUnread");
    try {
      await markAsUnread(id);
    } catch {
      showError("Failed to mark notification as unread");
    } finally {
      setLoadingActionId(undefined);
      setLoadingAction(null);
    }
  };

  return (
    <div className={styles.page}>
      <Navbar />
      <Background />
      <motion.div
        className={styles.hero}
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
      >
        <h1 className={styles.title}>NOTIFICATIONS</h1>
      </motion.div>

      <section className={styles.content}>
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p className={styles.loadingText}>Loading notifications...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className={styles.errorState}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <NotificationList
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
            loadingActionId={loadingActionId}
            loadingAction={loadingAction}
          />
        )}
      </section>
    </div>
  );
}

export default function NotificationReaderPage() {
  return (
    <ToastProvider>
      <NotificationReaderContent />
    </ToastProvider>
  );
}

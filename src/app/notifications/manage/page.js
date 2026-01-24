"use client";

/**
 * Notification Manager Page
 * Admin page for creating new notifications and managing existing ones.
 */

import React, { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import Background from "@/components/Background";
import Navbar from "@/components/Navbar";
import NotificationAdminList from "@/components/NotificationAdminList";
import NotificationForm from "@/components/NotificationForm";
import RouteGuard from "@/components/RouteGuard";
import { ToastProvider, useToast } from "@/components/ToastContainer";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/src/context/AuthContext";
import notificationService from "@/services/notificationService";
import styles from "./manage.module.css";

function NotificationManagerContent() {
  const {
    notifications,
    isLoading,
    error,
    refetch,
    deleteNotification,
  } = useNotifications({ includeExpired: true, sortByUnread: false });

  const { showError, showSuccess } = useToast();
  const { isAdmin, username } = useAuth();
  
  // Cache isAdmin result to avoid re-running effects
  const isAdminUser = isAdmin();

  const [deletingId, setDeletingId] = useState(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState(null);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Fetch users for admin user selection - only once on mount
  useEffect(() => {
    if (isAdminUser) {
      setUsersLoading(true);
      notificationService.getUsers()
        .then(data => setUsers(data || []))
        .catch(() => setUsers([]))
        .finally(() => setUsersLoading(false));
    }
  }, [isAdminUser]);

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error, showError]);

  const handleDelete = useCallback(
    async (id) => {
      setDeletingId(id);
      try {
        await deleteNotification(id);
        showSuccess("Notification deleted successfully");
      } catch {
        showError("Failed to delete notification");
      } finally {
        setDeletingId(undefined);
      }
    },
    [deleteNotification, showSuccess, showError]
  );

  const handleCreateNotification = useCallback(
    async (request) => {
      setIsSubmitting(true);
      try {
        await notificationService.createNotification(request);
        showSuccess("Notification created successfully");
        await refetch();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create notification";
        showError(message);
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [refetch, showSuccess, showError]
  );

  const handleProcessRecurring = useCallback(async () => {
    setIsProcessing(true);
    setProcessingResult(null);
    try {
      const result = await notificationService.processRecurring();
      setProcessingResult(result);
      if (result.errors > 0) {
        showError(`Processed with ${result.errors} error(s)`);
      } else {
        showSuccess(`Processed ${result.notificationsProcessed} notifications, created ${result.todosCreated} TODOs`);
      }
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process recurring notifications";
      showError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [refetch, showSuccess, showError]);

  return (
    <div className={styles.page}>
      <Navbar />
      <Background />
      <motion.div className={styles.hero} initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <h1 className={styles.title}>NOTIFICATION MANAGER</h1>
      </motion.div>

      <section className={styles.content}>
        {isAdminUser && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Admin Actions</h2>
            <div className={styles.adminActions}>
              <button className={`${styles.processButton} ${isProcessing ? styles.loading : ''}`} onClick={handleProcessRecurring} disabled={isProcessing}>
                {isProcessing ? 'Processing...' : 'Process Recurring Notifications'}
              </button>
              {processingResult && (
                <div className={styles.processingResult}>
                  <p>Processed: {processingResult.notificationsProcessed} | Created: {processingResult.todosCreated} | Errors: {processingResult.errors}</p>
                  {processingResult.errorMessages.length > 0 && (
                    <ul className={styles.errorList}>{processingResult.errorMessages.map((msg, i) => (<li key={i}>{msg}</li>))}</ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Existing Notifications</h2>

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
            <NotificationAdminList
              notifications={notifications}
              onDelete={handleDelete}
              isDeleting={deletingId}
            />
          )}
        </div>

        <div className={styles.section}>
          <NotificationForm
            onSubmit={handleCreateNotification}
            isSubmitting={isSubmitting}
            isAdmin={isAdminUser}
            currentUserId={username}
            users={users}
            usersLoading={usersLoading}
          />
        </div>
      </section>
    </div>
  );
}

export default function NotificationManagerPage() {
  return (
    <RouteGuard requiredRoles={["ROLE_ADMIN"]}>
      <ToastProvider>
        <NotificationManagerContent />
      </ToastProvider>
    </RouteGuard>
  );
}

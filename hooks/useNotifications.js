/**
 * useNotifications Hook
 * Custom hook for managing notification state and operations.
 */

import { useState, useCallback, useEffect } from 'react';
import notificationService, { NotificationError } from '@/services/notificationService';

/**
 * Sorts notifications: unread first, then by createdAt descending (newest first)
 */
export function sortNotifications(notifications) {
  return [...notifications].sort((a, b) => {
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Custom hook for managing notifications with optimistic updates
 */
export function useNotifications(options = {}) {
  const { includeExpired = false, sortByUnread = true } = options;

  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await notificationService.getNotifications(includeExpired);
      const sorted = sortByUnread ? sortNotifications(data) : data;
      setNotifications(sorted);
    } catch (err) {
      const message =
        err instanceof NotificationError
          ? err.message
          : 'Failed to fetch notifications';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [includeExpired, sortByUnread]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const markAsRead = useCallback(
    async (id) => {
      const previousNotifications = [...notifications];

      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        );
        return sortByUnread ? sortNotifications(updated) : updated;
      });

      try {
        await notificationService.markAsRead(id);
      } catch (err) {
        setNotifications(previousNotifications);
        const message =
          err instanceof NotificationError
            ? err.message
            : 'Failed to mark notification as read';
        setError(message);
      }
    },
    [notifications, sortByUnread]
  );

  const markAsUnread = useCallback(
    async (id) => {
      const previousNotifications = [...notifications];

      setNotifications((prev) => {
        const updated = prev.map((n) =>
          n.id === id ? { ...n, isRead: false } : n
        );
        return sortByUnread ? sortNotifications(updated) : updated;
      });

      try {
        await notificationService.markAsUnread(id);
      } catch (err) {
        setNotifications(previousNotifications);
        const message =
          err instanceof NotificationError
            ? err.message
            : 'Failed to mark notification as unread';
        setError(message);
      }
    },
    [notifications, sortByUnread]
  );

  const createAction = useCallback(
    async (id) => {
      const previousNotifications = [...notifications];

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, actionCreated: true } : n))
      );

      try {
        await notificationService.createAction(id);
      } catch (err) {
        setNotifications(previousNotifications);
        const message =
          err instanceof NotificationError
            ? err.message
            : 'Failed to create TODO from notification';
        setError(message);
      }
    },
    [notifications]
  );

  const deleteNotification = useCallback(
    async (id) => {
      const previousNotifications = [...notifications];

      setNotifications((prev) => prev.filter((n) => n.id !== id));

      try {
        await notificationService.deleteNotification(id);
      } catch (err) {
        setNotifications(previousNotifications);
        const message =
          err instanceof NotificationError
            ? err.message
            : 'Failed to delete notification';
        setError(message);
      }
    },
    [notifications]
  );

  return {
    notifications,
    isLoading,
    error,
    refetch,
    markAsRead,
    markAsUnread,
    createAction,
    deleteNotification,
  };
}

export default useNotifications;

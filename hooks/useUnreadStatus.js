/**
 * useUnreadStatus Hook
 * Lightweight hook for navbar unread indicator.
 */

import { useState, useCallback, useEffect } from 'react';
import { getToken } from '@/src/lib/tokenStorage';
import notificationService, { NotificationError } from '@/services/notificationService';

/**
 * Custom hook for checking unread notification status
 * Used by the navbar to determine notification icon color
 */
export function useUnreadStatus() {
  const [hasUnread, setHasUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setHasUnread(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const result = await notificationService.hasUnreadNotifications();
      setHasUnread(result);
    } catch (err) {
      if (err instanceof NotificationError && err.status !== 403) {
        console.error('Failed to check unread status:', err.message);
      }
      setHasUnread(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    hasUnread,
    isLoading,
    refetch,
  };
}

export default useUnreadStatus;

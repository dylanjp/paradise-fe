/**
 * Notification Service
 * Centralized API communication layer for all notification operations.
 */

import apiClient from "@/src/lib/apiClient";

/**
 * Custom error class for notification-specific errors
 */
export class NotificationError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'NotificationError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Transforms API errors into user-friendly NotificationError instances
 */
function handleApiError(error, operation) {
  if (error instanceof TypeError && error.message === 'Failed to fetch') {
    return new NotificationError(
      'Unable to connect to server. Please check your network connection.',
      undefined,
      0
    );
  }

  const apiError = error;

  if (apiError.status === 404) {
    return new NotificationError(
      'Notification not found. It may have been deleted.',
      'NOTIFICATION_NOT_FOUND',
      404
    );
  }

  if (apiError.status === 400) {
    const code = apiError.data?.code;
    if (code === 'ACTION_ALREADY_CREATED') {
      return new NotificationError(
        'A TODO has already been created from this notification.',
        'ACTION_ALREADY_CREATED',
        400
      );
    }
    if (code === 'NOTIFICATION_EXPIRED') {
      return new NotificationError(
        'Cannot perform this action on an expired notification.',
        'NOTIFICATION_EXPIRED',
        400
      );
    }
    return new NotificationError(
      apiError.message || 'Invalid request.',
      'VALIDATION_ERROR',
      400
    );
  }

  if (apiError.status === 401) {
    return new NotificationError(
      'Session expired. Please log in again.',
      'UNAUTHORIZED',
      401
    );
  }

  if (apiError.status === 403) {
    return new NotificationError(
      'You do not have permission to perform this action.',
      'UNAUTHORIZED',
      403
    );
  }

  if (apiError.status && apiError.status >= 500) {
    return new NotificationError(
      'Server error. Please try again later.',
      undefined,
      apiError.status
    );
  }

  return new NotificationError(
    `Failed to ${operation}. Please try again.`,
    undefined,
    apiError.status
  );
}

const NOTIFICATIONS_BASE = '/api/notifications';
const USERS_BASE = '/admin/users';

export const notificationService = {
  async getUsers() {
    try {
      const response = await apiClient.get(USERS_BASE);
      // Handle both response formats: { users: [...] } or [...]
      return response.users || response || [];
    } catch (error) {
      throw handleApiError(error, 'fetch users');
    }
  },
  async getNotifications(includeExpired = false) {
    try {
      const endpoint = includeExpired
        ? `${NOTIFICATIONS_BASE}?includeExpired=true`
        : NOTIFICATIONS_BASE;
      const data = await apiClient.get(endpoint);
      return data;
    } catch (error) {
      throw handleApiError(error, 'fetch notifications');
    }
  },

  async getNotification(id) {
    try {
      const data = await apiClient.get(`${NOTIFICATIONS_BASE}/${id}`);
      return data;
    } catch (error) {
      throw handleApiError(error, 'fetch notification');
    }
  },

  async markAsRead(id) {
    try {
      await apiClient.post(`${NOTIFICATIONS_BASE}/${id}/read`, {});
    } catch (error) {
      throw handleApiError(error, 'mark notification as read');
    }
  },

  async markAsUnread(id) {
    try {
      await apiClient.post(`${NOTIFICATIONS_BASE}/${id}/unread`, {});
    } catch (error) {
      throw handleApiError(error, 'mark notification as unread');
    }
  },

  async createAction(id) {
    try {
      await apiClient.post(`${NOTIFICATIONS_BASE}/${id}/action`, {});
    } catch (error) {
      throw handleApiError(error, 'create TODO from notification');
    }
  },

  async createNotification(request) {
    try {
      const data = await apiClient.post(NOTIFICATIONS_BASE, request);
      return data;
    } catch (error) {
      throw handleApiError(error, 'create notification');
    }
  },

  async deleteNotification(id) {
    try {
      await apiClient.delete(`${NOTIFICATIONS_BASE}/${id}`);
    } catch (error) {
      throw handleApiError(error, 'delete notification');
    }
  },

  async hasUnreadNotifications() {
    try {
      const notifications = await this.getNotifications(false);
      return notifications.some(n => !n.isRead);
    } catch (error) {
      throw handleApiError(error, 'check unread notifications');
    }
  },

  async processRecurring() {
    try {
      const data = await apiClient.post(`${NOTIFICATIONS_BASE}/process-recurring`, {});
      return data;
    } catch (error) {
      throw handleApiError(error, 'process recurring notifications');
    }
  },
};

export default notificationService;

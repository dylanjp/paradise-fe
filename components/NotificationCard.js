/**
 * NotificationCard Component
 * Displays a single notification with actions.
 */

import React from 'react';
import styles from './NotificationCard.module.css';

/**
 * Formats an ISO timestamp to a human-readable format
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 1) return 'Just now';
      return `${diffMinutes}m ago`;
    }
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Formats a recurrence rule to a human-readable summary
 */
function formatRecurrence(rule) {
  if (!rule) return '';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (rule.type) {
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      if (rule.dayOfWeek !== undefined) {
        return `Weekly on ${dayNames[rule.dayOfWeek]}`;
      }
      return 'Weekly';
    case 'MONTHLY':
      if (rule.dayOfMonth !== undefined) {
        const suffix = getOrdinalSuffix(rule.dayOfMonth);
        return `Monthly on ${rule.dayOfMonth}${suffix}`;
      }
      return 'Monthly';
    default:
      return 'Recurring';
  }
}

/**
 * Gets ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Formats expiration date for display
 */
function formatExpiration(expiresAt) {
  const date = new Date(expiresAt);
  const now = new Date();

  if (date < now) {
    return 'Expired';
  }

  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours <= 1) return 'Expires soon';
    return `Expires in ${diffHours}h`;
  }
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays < 7) return `Expires in ${diffDays} days`;

  return `Expires ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

const NotificationCard = ({
  notification,
  onMarkRead,
  onMarkUnread,
  isActionLoading = false,
  loadingAction = null,
}) => {
  const {
    id,
    subject,
    messageBody,
    createdAt,
    expiresAt,
    recurrenceRule,
    isRead,
  } = notification;

  const handleMarkRead = () => {
    if (!isActionLoading) {
      onMarkRead(id);
    }
  };

  const handleMarkUnread = () => {
    if (!isActionLoading) {
      onMarkUnread(id);
    }
  };

  const cardClassName = `${styles.card} ${isRead ? styles.read : styles.unread}`;

  return (
    <article className={cardClassName} data-testid="notification-card">
      <header className={styles.header}>
        <h3 className={styles.subject}>{subject}</h3>
      </header>

      <div className={styles.metadata}>
        <span className={styles.timestamp}>
          {formatTimestamp(createdAt)}
        </span>

        {expiresAt && (
          <span className={styles.expirationIndicator}>
            {formatExpiration(expiresAt)}
          </span>
        )}

        {recurrenceRule && (
          <span className={styles.recurrenceIndicator}>
            {formatRecurrence(recurrenceRule)}
          </span>
        )}
      </div>

      <div className={styles.messageBody}>
        {messageBody}
      </div>

      <div className={styles.actions}>
        {isRead ? (
          <button
            type="button"
            className={`${styles.markUnreadButton} ${loadingAction === 'markUnread' ? styles.loading : ''}`}
            onClick={handleMarkUnread}
            disabled={isActionLoading}
            aria-label="Mark as unread"
          >
            Mark as Unread
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.markReadButton} ${loadingAction === 'markRead' ? styles.loading : ''}`}
            onClick={handleMarkRead}
            disabled={isActionLoading}
            aria-label="Mark as read"
          >
            Mark as Read
          </button>
        )}
      </div>
    </article>
  );
};

export default NotificationCard;

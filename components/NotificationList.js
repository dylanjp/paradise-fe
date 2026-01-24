/**
 * NotificationList Component
 * Container for rendering sorted notification cards.
 */

import React from 'react';
import NotificationCard from './NotificationCard';
import styles from './NotificationList.module.css';

const NotificationList = ({
  notifications,
  onMarkRead,
  onMarkUnread,
  loadingActionId,
  loadingAction,
}) => {
  if (!notifications || notifications.length === 0) {
    return (
      <div className={styles.container} data-testid="notification-list">
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>⚡</div>
          <p className={styles.emptyText}>No notifications</p>
          <p className={styles.emptySubtext}>
            You&apos;re all caught up. New notifications will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="notification-list">
      <div className={styles.list}>
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
            onMarkUnread={onMarkUnread}
            isActionLoading={loadingActionId === notification.id}
            loadingAction={loadingActionId === notification.id ? loadingAction : null}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationList;

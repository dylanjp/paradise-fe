/**
 * NotificationAdminList Component
 * Compact admin table for notification management.
 */

import React, { useState } from 'react';
import styles from './NotificationAdminList.module.css';

function formatRecurrenceSummary(rule) {
  if (!rule) return '-';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  switch (rule.frequency) {
    case 'DAILY':
      return 'Daily';
    case 'WEEKLY':
      if (rule.dayOfWeek !== undefined) {
        return `Weekly (${dayNames[rule.dayOfWeek]})`;
      }
      return 'Weekly';
    case 'MONTHLY':
      if (rule.dayOfMonth !== undefined) {
        return `Monthly (${rule.dayOfMonth})`;
      }
      return 'Monthly';
    default:
      return 'Recurring';
  }
}

function formatExpiresAt(expiresAt) {
  if (!expiresAt) return 'Never';
  const date = new Date(expiresAt);
  const now = new Date();
  if (date < now) return 'Expired';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

const NotificationAdminList = ({ notifications, onDelete, isDeleting }) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteClick = (id) => setConfirmDeleteId(id);
  const handleConfirmDelete = (id) => { onDelete(id); setConfirmDeleteId(null); };
  const handleCancelDelete = () => setConfirmDeleteId(null);

  if (!notifications || notifications.length === 0) {
    return (
      <div className={styles.container} data-testid="notification-admin-list">
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No notifications found</p>
          <p className={styles.emptySubtext}>Create a new notification using the form below.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="notification-admin-list">
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.headerCell}>Subject</th>
              <th className={styles.headerCell}>Scope</th>
              <th className={styles.headerCell}>Expires</th>
              <th className={styles.headerCell}>Recurrence</th>
              <th className={styles.headerCell}>Status</th>
              <th className={styles.headerCell}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => {
              const isExpired = notification.expiresAt && new Date(notification.expiresAt) < new Date();
              const isConfirming = confirmDeleteId === notification.id;
              const isCurrentlyDeleting = isDeleting === notification.id;

              return (
                <tr key={notification.id} className={styles.row} data-testid="notification-admin-row">
                  <td className={styles.cell}><span className={styles.subject} title={notification.subject}>{truncateText(notification.subject, 40)}</span></td>
                  <td className={styles.cell}><span className={`${styles.scopeBadge} ${notification.isGlobal ? styles.globalScope : styles.userScope}`}>{notification.isGlobal ? 'Global' : 'User'}</span></td>
                  <td className={styles.cell}><span className={`${styles.expiresText} ${isExpired ? styles.expired : ''}`}>{formatExpiresAt(notification.expiresAt)}</span></td>
                  <td className={styles.cell}><span className={styles.recurrenceText}>{formatRecurrenceSummary(notification.recurrenceRule)}</span></td>
                  <td className={styles.cell}><span className={`${styles.statusBadge} ${isExpired ? styles.expiredStatus : styles.activeStatus}`}>{isExpired ? 'Expired' : 'Active'}</span></td>
                  <td className={styles.cell}>
                    {isConfirming ? (
                      <div className={styles.confirmActions}>
                        <button type="button" className={`${styles.confirmButton} ${isCurrentlyDeleting ? styles.loading : ''}`} onClick={() => handleConfirmDelete(notification.id)} disabled={isCurrentlyDeleting} aria-label="Confirm delete">{isCurrentlyDeleting ? '...' : 'Yes'}</button>
                        <button type="button" className={styles.cancelButton} onClick={handleCancelDelete} disabled={isCurrentlyDeleting} aria-label="Cancel delete">No</button>
                      </div>
                    ) : (
                      <button type="button" className={styles.deleteButton} onClick={() => handleDeleteClick(notification.id)} disabled={!!isDeleting} aria-label={`Delete notification: ${notification.subject}`}>Delete</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NotificationAdminList;

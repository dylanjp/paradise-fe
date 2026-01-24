/**
 * NotificationIcon Component
 * Navbar icon with unread status indication.
 */

'use client';

import { useRouter } from 'next/navigation';
import { FaExclamation } from 'react-icons/fa';
import styles from './NotificationIcon.module.css';

/**
 * NotificationIcon displays the notification bell icon with visual indication
 * of unread status. Clicking navigates to the notifications page.
 */
export function NotificationIcon({ hasUnread, onClick }) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    router.push('/notifications');
  };

  return (
    <span
      className={`${styles.icon} ${hasUnread ? styles.unread : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={hasUnread ? 'Notifications (unread)' : 'Notifications'}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <FaExclamation />
    </span>
  );
}

export default NotificationIcon;

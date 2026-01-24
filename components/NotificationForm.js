/**
 * NotificationForm Component
 * Form for creating new notifications with TRON-inspired styling.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import styles from './NotificationForm.module.css';

const INITIAL_FORM_STATE = {
  subject: '',
  messageBody: '',
  isGlobal: false,
  selectedUserIds: [],
  hasExpiration: false,
  expiresAt: '',
  hasRecurrence: false,
  frequency: 'DAILY',
  dayOfWeek: 'random',
  dayOfMonth: 'random',
  hasActionItem: false,
  actionDescription: '',
};

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function NotificationForm({ onSubmit, isSubmitting, isAdmin = false, currentUserId = null, users = [], usersLoading = false }) {
  const [formState, setFormState] = useState(() => ({
    ...INITIAL_FORM_STATE,
    // Pre-select current user by default for admins
    selectedUserIds: currentUserId ? [currentUserId] : [],
  }));
  const [errors, setErrors] = useState({});

  // Update selectedUserIds when users list loads to use correct user ID format
  useEffect(() => {
    if (isAdmin && currentUserId && users.length > 0 && !formState.isGlobal) {
      const currentUserInList = users.find(u => u.id === currentUserId || u.username === currentUserId);
      if (currentUserInList && !formState.selectedUserIds.includes(currentUserInList.id)) {
        // Replace username with actual user ID if needed
        setFormState(prev => ({
          ...prev,
          selectedUserIds: prev.selectedUserIds.map(id => 
            id === currentUserId ? currentUserInList.id : id
          ).filter((id, idx, arr) => arr.indexOf(id) === idx), // dedupe
        }));
      }
    }
  }, [isAdmin, currentUserId, users, formState.isGlobal, formState.selectedUserIds]);

  // Reset selectedUserIds when isGlobal changes
  useEffect(() => {
    if (formState.isGlobal) {
      setFormState(prev => ({ ...prev, selectedUserIds: [] }));
    } else if (currentUserId) {
      // Re-select current user when switching back from global
      setFormState(prev => ({
        ...prev,
        selectedUserIds: prev.selectedUserIds.length === 0 ? [currentUserId] : prev.selectedUserIds,
      }));
    }
  }, [formState.isGlobal, currentUserId]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formState.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formState.subject.length > 200) {
      newErrors.subject = 'Subject must be 200 characters or less';
    }

    if (!formState.messageBody.trim()) {
      newErrors.messageBody = 'Message body is required';
    } else if (formState.messageBody.length > 2000) {
      newErrors.messageBody = 'Message body must be 2000 characters or less';
    }

    // For admins with non-global notifications, require at least one user selected
    if (isAdmin && !formState.isGlobal && formState.selectedUserIds.length === 0) {
      newErrors.selectedUserIds = 'At least one user must be selected for non-global notifications';
    }

    if (formState.hasExpiration && formState.expiresAt) {
      const expirationDate = new Date(formState.expiresAt);
      if (expirationDate <= new Date()) {
        newErrors.expiresAt = 'Expiration date must be in the future';
      }
    }

    if (formState.hasActionItem && !formState.actionDescription.trim()) {
      newErrors.actionDescription = 'Action description is required when action item is enabled';
    } else if (formState.actionDescription.length > 500) {
      newErrors.actionDescription = 'Action description must be 500 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState, isAdmin]);

  const handleInputChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleSelectChange = useCallback((name, value) => {
    setFormState(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleUserToggle = useCallback((userId) => {
    setFormState(prev => {
      const currentSelected = prev.selectedUserIds;
      const isSelected = currentSelected.includes(userId);
      return {
        ...prev,
        selectedUserIds: isSelected
          ? currentSelected.filter(id => id !== userId)
          : [...currentSelected, userId],
      };
    });
    if (errors.selectedUserIds) {
      setErrors(prev => ({ ...prev, selectedUserIds: undefined }));
    }
  }, [errors.selectedUserIds]);

  const resetForm = useCallback(() => {
    setFormState({
      ...INITIAL_FORM_STATE,
      // Keep current user selected after reset
      selectedUserIds: currentUserId ? [currentUserId] : [],
    });
    setErrors({});
  }, [currentUserId]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const request = {
      subject: formState.subject.trim(),
      messageBody: formState.messageBody.trim(),
      isGlobal: isAdmin ? formState.isGlobal : false,
      hasActionItem: formState.hasActionItem,
    };

    // For non-admin users, always assign to themselves
    // For admin users with non-global notifications, use selected users
    if (!isAdmin) {
      if (currentUserId) {
        request.targetUserIds = [currentUserId];
      }
    } else if (!formState.isGlobal && formState.selectedUserIds.length > 0) {
      request.targetUserIds = formState.selectedUserIds;
    }

    if (formState.hasExpiration && formState.expiresAt) {
      request.expiresAt = new Date(formState.expiresAt).toISOString();
    }

    if (formState.hasRecurrence) {
      const recurrenceRule = { type: formState.frequency };
      if (formState.frequency === 'WEEKLY' && formState.dayOfWeek !== 'random') {
        recurrenceRule.dayOfWeek = formState.dayOfWeek;
      }
      if (formState.frequency === 'MONTHLY' && formState.dayOfMonth !== 'random') {
        recurrenceRule.dayOfMonth = formState.dayOfMonth;
      }
      request.recurrenceRule = recurrenceRule;
    }

    if (formState.hasActionItem && formState.actionDescription.trim()) {
      request.actionItem = {
        description: formState.actionDescription.trim(),
        category: 'personal',
      };
    }

    try {
      await onSubmit(request);
      resetForm();
    } catch {
      // Error handling is done by the parent component
    }
  }, [formState, validateForm, onSubmit, resetForm, isAdmin, currentUserId]);

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>Create Notification</h3>

      <div className={styles.fieldGroup}>
        <label htmlFor="subject" className={styles.label}>
          Subject <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formState.subject}
          onChange={handleInputChange}
          className={`${styles.input} ${errors.subject ? styles.inputError : ''}`}
          placeholder="Enter notification subject"
          maxLength={200}
          disabled={isSubmitting}
        />
        {errors.subject && <span className={styles.errorText}>{errors.subject}</span>}
        <span className={styles.charCount}>{formState.subject.length}/200</span>
      </div>

      <div className={styles.fieldGroup}>
        <label htmlFor="messageBody" className={styles.label}>
          Message Body <span className={styles.required}>*</span>
        </label>
        <textarea
          id="messageBody"
          name="messageBody"
          value={formState.messageBody}
          onChange={handleInputChange}
          className={`${styles.textarea} ${errors.messageBody ? styles.inputError : ''}`}
          placeholder="Enter notification message"
          maxLength={2000}
          rows={4}
          disabled={isSubmitting}
        />
        {errors.messageBody && <span className={styles.errorText}>{errors.messageBody}</span>}
        <span className={styles.charCount}>{formState.messageBody.length}/2000</span>
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="isGlobal" checked={formState.isGlobal} onChange={handleInputChange} className={styles.checkbox} disabled={isSubmitting || !isAdmin} />
          <span className={styles.checkboxText}>Global Notification</span>
        </label>
        <span className={styles.helpText}>{isAdmin ? 'Send to all users' : 'Only admins can create global notifications'}</span>
      </div>

      {isAdmin && !formState.isGlobal && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Assign to Users <span className={styles.required}>*</span></label>
          {usersLoading ? (
            <div className={styles.loadingUsers}>Loading users...</div>
          ) : users.length === 0 ? (
            <div className={styles.userList}>
              <label className={styles.userCheckboxLabel}>
                <input
                  type="checkbox"
                  checked={formState.selectedUserIds.includes(currentUserId)}
                  onChange={() => handleUserToggle(currentUserId)}
                  className={styles.checkbox}
                  disabled={isSubmitting}
                />
                <span className={styles.userCheckboxText}>{currentUserId} (you)</span>
              </label>
              <span className={styles.helpText}>User list unavailable - showing current user only</span>
            </div>
          ) : (
            <div className={styles.userList}>
              {users.map(user => (
                <label key={user.id} className={styles.userCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={formState.selectedUserIds.includes(user.id)}
                    onChange={() => handleUserToggle(user.id)}
                    className={styles.checkbox}
                    disabled={isSubmitting}
                  />
                  <span className={styles.userCheckboxText}>
                    {user.username || user.id}
                    {(user.id === currentUserId || user.username === currentUserId) && ' (you)'}
                  </span>
                </label>
              ))}
            </div>
          )}
          {errors.selectedUserIds && <span className={styles.errorText}>{errors.selectedUserIds}</span>}
        </div>
      )}

      {!isAdmin && (
        <div className={styles.fieldGroup}>
          <span className={styles.helpText}>This notification will be assigned to you.</span>
        </div>
      )}

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="hasExpiration" checked={formState.hasExpiration} onChange={handleInputChange} className={styles.checkbox} disabled={isSubmitting} />
          <span className={styles.checkboxText}>Set Expiration</span>
        </label>
      </div>

      {formState.hasExpiration && (
        <div className={styles.fieldGroup}>
          <label htmlFor="expiresAt" className={styles.label}>Expires At</label>
          <input type="datetime-local" id="expiresAt" name="expiresAt" value={formState.expiresAt} onChange={handleInputChange} className={`${styles.input} ${errors.expiresAt ? styles.inputError : ''}`} disabled={isSubmitting} />
          {errors.expiresAt && <span className={styles.errorText}>{errors.expiresAt}</span>}
        </div>
      )}

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="hasRecurrence" checked={formState.hasRecurrence} onChange={handleInputChange} className={styles.checkbox} disabled={isSubmitting} />
          <span className={styles.checkboxText}>Enable Recurrence</span>
        </label>
      </div>

      {formState.hasRecurrence && (
        <div className={styles.recurrenceSection}>
          <div className={styles.fieldGroup}>
            <label htmlFor="frequency" className={styles.label}>Frequency</label>
            <select id="frequency" name="frequency" value={formState.frequency} onChange={handleInputChange} className={styles.select} disabled={isSubmitting}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          {formState.frequency === 'WEEKLY' && (
            <div className={styles.fieldGroup}>
              <label htmlFor="dayOfWeek" className={styles.label}>Day of Week</label>
              <select id="dayOfWeek" value={formState.dayOfWeek} onChange={(e) => handleSelectChange('dayOfWeek', e.target.value === 'random' ? 'random' : parseInt(e.target.value))} className={styles.select} disabled={isSubmitting}>
                <option value="random">Random</option>
                {DAYS_OF_WEEK.map(day => (<option key={day.value} value={day.value}>{day.label}</option>))}
              </select>
            </div>
          )}

          {formState.frequency === 'MONTHLY' && (
            <div className={styles.fieldGroup}>
              <label htmlFor="dayOfMonth" className={styles.label}>Day of Month</label>
              <select id="dayOfMonth" value={formState.dayOfMonth} onChange={(e) => handleSelectChange('dayOfMonth', e.target.value === 'random' ? 'random' : parseInt(e.target.value))} className={styles.select} disabled={isSubmitting}>
                <option value="random">Random</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (<option key={day} value={day}>{day}</option>))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" name="hasActionItem" checked={formState.hasActionItem} onChange={handleInputChange} className={styles.checkbox} disabled={isSubmitting} />
          <span className={styles.checkboxText}>Enable Action Item</span>
        </label>
        <span className={styles.helpText}>Allow users to create a TODO from this notification</span>
      </div>

      {formState.hasActionItem && (
        <div className={styles.fieldGroup}>
          <label htmlFor="actionDescription" className={styles.label}>Action Description <span className={styles.required}>*</span></label>
          <input type="text" id="actionDescription" name="actionDescription" value={formState.actionDescription} onChange={handleInputChange} className={`${styles.input} ${errors.actionDescription ? styles.inputError : ''}`} placeholder="Describe the action to be taken" maxLength={500} disabled={isSubmitting} />
          {errors.actionDescription && <span className={styles.errorText}>{errors.actionDescription}</span>}
          <span className={styles.charCount}>{formState.actionDescription.length}/500</span>
        </div>
      )}

      <div className={styles.submitSection}>
        <button type="submit" className={`${styles.submitButton} ${isSubmitting ? styles.loading : ''}`} disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Notification'}
        </button>
      </div>
    </form>
  );
}

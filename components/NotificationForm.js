/**
 * NotificationForm Component
 * Form for creating new notifications with TRON-inspired styling.
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import styles from './NotificationForm.module.css';
import {
  MONTH_NAMES,
  getMaxDayForMonth,
  validateYearlyRecurrence,
  validateRandomDateRangeRecurrence,
  formatRecurrencePreview
} from '../utils/recurrenceValidation';

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
  // YEARLY fields
  yearlyMonth: '',
  yearlyDay: '',
  // RANDOM_DATE_RANGE fields
  rangeStartMonth: '',
  rangeStartDay: '',
  rangeEndMonth: '',
  rangeEndDay: '',
  hasActionItem: false,
  actionDescription: '',
};

const RECURRENCE_TYPES = [
  {
    group: 'Simple patterns',
    options: [
      { value: 'DAILY', label: 'Daily' },
      { value: 'WEEKLY', label: 'Weekly' },
      { value: 'MONTHLY', label: 'Monthly' },
      { value: 'YEARLY', label: 'Yearly (specific date)' },
    ]
  },
  {
    group: 'Randomized patterns',
    options: [
      { value: 'RANDOM_WEEKLY', label: 'Random weekly' },
      { value: 'RANDOM_MONTHLY', label: 'Random monthly' },
      { value: 'RANDOM_DATE_RANGE', label: 'Random date within range' },
    ]
  },
];

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

    // Validate YEARLY recurrence
    if (formState.hasRecurrence && formState.frequency === 'YEARLY') {
      const yearlyResult = validateYearlyRecurrence({
        month: formState.yearlyMonth,
        dayOfMonth: formState.yearlyDay
      });
      if (!yearlyResult.valid) {
        if (yearlyResult.errors.month) {
          newErrors.yearlyMonth = yearlyResult.errors.month;
        }
        if (yearlyResult.errors.dayOfMonth) {
          newErrors.yearlyDay = yearlyResult.errors.dayOfMonth;
        }
      }
    }

    // Validate RANDOM_DATE_RANGE recurrence
    if (formState.hasRecurrence && formState.frequency === 'RANDOM_DATE_RANGE') {
      const rangeResult = validateRandomDateRangeRecurrence({
        startMonth: formState.rangeStartMonth,
        startDay: formState.rangeStartDay,
        endMonth: formState.rangeEndMonth,
        endDay: formState.rangeEndDay
      });
      if (!rangeResult.valid) {
        if (rangeResult.errors.startMonth) {
          newErrors.rangeStartMonth = rangeResult.errors.startMonth;
        }
        if (rangeResult.errors.startDay) {
          newErrors.rangeStartDay = rangeResult.errors.startDay;
        }
        if (rangeResult.errors.endMonth) {
          newErrors.rangeEndMonth = rangeResult.errors.endMonth;
        }
        if (rangeResult.errors.endDay) {
          newErrors.rangeEndDay = rangeResult.errors.endDay;
        }
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

  // Blur handler for field-level validation
  const handleFieldBlur = useCallback((fieldName) => {
    // Validate YEARLY fields on blur
    if (formState.frequency === 'YEARLY') {
      if (fieldName === 'yearlyMonth' || fieldName === 'yearlyDay') {
        const yearlyResult = validateYearlyRecurrence({
          month: formState.yearlyMonth,
          dayOfMonth: formState.yearlyDay
        });
        setErrors(prev => {
          const newErrors = { ...prev };
          if (fieldName === 'yearlyMonth') {
            if (yearlyResult.errors.month) {
              newErrors.yearlyMonth = yearlyResult.errors.month;
            } else {
              delete newErrors.yearlyMonth;
            }
          }
          if (fieldName === 'yearlyDay') {
            if (yearlyResult.errors.dayOfMonth) {
              newErrors.yearlyDay = yearlyResult.errors.dayOfMonth;
            } else {
              delete newErrors.yearlyDay;
            }
          }
          return newErrors;
        });
      }
    }

    // Validate RANDOM_DATE_RANGE fields on blur
    if (formState.frequency === 'RANDOM_DATE_RANGE') {
      if (['rangeStartMonth', 'rangeStartDay', 'rangeEndMonth', 'rangeEndDay'].includes(fieldName)) {
        const rangeResult = validateRandomDateRangeRecurrence({
          startMonth: formState.rangeStartMonth,
          startDay: formState.rangeStartDay,
          endMonth: formState.rangeEndMonth,
          endDay: formState.rangeEndDay
        });
        setErrors(prev => {
          const newErrors = { ...prev };
          const fieldMapping = {
            rangeStartMonth: 'startMonth',
            rangeStartDay: 'startDay',
            rangeEndMonth: 'endMonth',
            rangeEndDay: 'endDay'
          };
          const errorKey = fieldMapping[fieldName];
          if (rangeResult.errors[errorKey]) {
            newErrors[fieldName] = rangeResult.errors[errorKey];
          } else {
            delete newErrors[fieldName];
          }
          return newErrors;
        });
      }
    }
  }, [formState]);

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
      if (formState.frequency === 'YEARLY') {
        recurrenceRule.month = Number(formState.yearlyMonth);
        recurrenceRule.dayOfMonth = Number(formState.yearlyDay);
      }
      if (formState.frequency === 'RANDOM_DATE_RANGE') {
        recurrenceRule.startMonth = Number(formState.rangeStartMonth);
        recurrenceRule.startDay = Number(formState.rangeStartDay);
        recurrenceRule.endMonth = Number(formState.rangeEndMonth);
        recurrenceRule.endDay = Number(formState.rangeEndDay);
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
              {RECURRENCE_TYPES.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.options.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </optgroup>
              ))}
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

          {formState.frequency === 'YEARLY' && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="yearlyMonth" className={styles.label}>Month</label>
                <select
                  id="yearlyMonth"
                  name="yearlyMonth"
                  value={formState.yearlyMonth}
                  onChange={handleInputChange}
                  onBlur={() => handleFieldBlur('yearlyMonth')}
                  className={`${styles.select} ${errors.yearlyMonth ? styles.inputError : ''}`}
                  disabled={isSubmitting}
                >
                  <option value="">Select month</option>
                  {MONTH_NAMES.map((month, index) => (
                    <option key={index + 1} value={index + 1}>{month}</option>
                  ))}
                </select>
                {errors.yearlyMonth && <span className={styles.errorText}>{errors.yearlyMonth}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="yearlyDay" className={styles.label}>Day</label>
                <input
                  type="number"
                  id="yearlyDay"
                  name="yearlyDay"
                  value={formState.yearlyDay}
                  onChange={handleInputChange}
                  onBlur={() => handleFieldBlur('yearlyDay')}
                  className={`${styles.input} ${errors.yearlyDay ? styles.inputError : ''}`}
                  min={1}
                  max={formState.yearlyMonth ? getMaxDayForMonth(Number(formState.yearlyMonth)) : 31}
                  placeholder="Day"
                  disabled={isSubmitting}
                />
                {errors.yearlyDay && <span className={styles.errorText}>{errors.yearlyDay}</span>}
              </div>

              {formState.yearlyMonth === '2' && formState.yearlyDay === '29' && (
                <div className={styles.leapYearNote}>
                  This notification will only trigger in leap years
                </div>
              )}

              {formState.yearlyMonth && formState.yearlyDay && (
                <div className={styles.recurrencePreview}>
                  {formatRecurrencePreview({
                    type: 'YEARLY',
                    month: Number(formState.yearlyMonth),
                    dayOfMonth: Number(formState.yearlyDay)
                  })}
                </div>
              )}
            </>
          )}

          {formState.frequency === 'RANDOM_DATE_RANGE' && (
            <>
              <div className={styles.dateRangePicker}>
                <div className={styles.dateRangeGroup}>
                  <span className={styles.dateRangeLabel}>Start of range</span>
                  <div className={styles.dateRangeInputs}>
                    <select
                      id="rangeStartMonth"
                      name="rangeStartMonth"
                      value={formState.rangeStartMonth}
                      onChange={handleInputChange}
                      onBlur={() => handleFieldBlur('rangeStartMonth')}
                      className={`${styles.select} ${errors.rangeStartMonth ? styles.inputError : ''}`}
                      disabled={isSubmitting}
                    >
                      <option value="">Month</option>
                      {MONTH_NAMES.map((month, index) => (
                        <option key={index + 1} value={index + 1}>{month}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      id="rangeStartDay"
                      name="rangeStartDay"
                      value={formState.rangeStartDay}
                      onChange={handleInputChange}
                      onBlur={() => handleFieldBlur('rangeStartDay')}
                      className={`${styles.input} ${styles.dayInput} ${errors.rangeStartDay ? styles.inputError : ''}`}
                      min={1}
                      max={formState.rangeStartMonth ? getMaxDayForMonth(Number(formState.rangeStartMonth)) : 31}
                      placeholder="Day"
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.rangeStartMonth && <span className={styles.errorText}>{errors.rangeStartMonth}</span>}
                  {errors.rangeStartDay && <span className={styles.errorText}>{errors.rangeStartDay}</span>}
                </div>

                <div className={styles.dateRangeGroup}>
                  <span className={styles.dateRangeLabel}>End of range</span>
                  <div className={styles.dateRangeInputs}>
                    <select
                      id="rangeEndMonth"
                      name="rangeEndMonth"
                      value={formState.rangeEndMonth}
                      onChange={handleInputChange}
                      onBlur={() => handleFieldBlur('rangeEndMonth')}
                      className={`${styles.select} ${errors.rangeEndMonth ? styles.inputError : ''}`}
                      disabled={isSubmitting}
                    >
                      <option value="">Month</option>
                      {MONTH_NAMES.map((month, index) => (
                        <option key={index + 1} value={index + 1}>{month}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      id="rangeEndDay"
                      name="rangeEndDay"
                      value={formState.rangeEndDay}
                      onChange={handleInputChange}
                      onBlur={() => handleFieldBlur('rangeEndDay')}
                      className={`${styles.input} ${styles.dayInput} ${errors.rangeEndDay ? styles.inputError : ''}`}
                      min={1}
                      max={formState.rangeEndMonth ? getMaxDayForMonth(Number(formState.rangeEndMonth)) : 31}
                      placeholder="Day"
                      disabled={isSubmitting}
                    />
                  </div>
                  {errors.rangeEndMonth && <span className={styles.errorText}>{errors.rangeEndMonth}</span>}
                  {errors.rangeEndDay && <span className={styles.errorText}>{errors.rangeEndDay}</span>}
                </div>
              </div>

              {formState.rangeStartMonth && formState.rangeStartDay && formState.rangeEndMonth && formState.rangeEndDay && (
                <div className={styles.recurrencePreview}>
                  {formatRecurrencePreview({
                    type: 'RANDOM_DATE_RANGE',
                    startMonth: Number(formState.rangeStartMonth),
                    startDay: Number(formState.rangeStartDay),
                    endMonth: Number(formState.rangeEndMonth),
                    endDay: Number(formState.rangeEndDay)
                  })}
                </div>
              )}
            </>
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

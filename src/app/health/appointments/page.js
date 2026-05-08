"use client";

/**
 * Appointments Screen
 * View and manage doctor appointments (Upcoming / Past tabs) and
 * health maintenance reminders. Supports add and delete with confirmation.
 *
 * Requirements: 7.1–7.8, 8.1–8.5, 12.4
 */

import { useState, useEffect, useMemo } from "react";
import { useHealth } from "@/src/context/HealthContext";
import TCard from "@/components/TCard";
import TButton from "@/components/TButton";
import TInput from "@/components/TInput";
import TSelect from "@/components/TSelect";
import TTextarea from "@/components/TTextarea";
import HealthModal from "@/components/HealthModal";
import { SPECIALTIES } from "@/utils/healthConstants";
import { formatShortDate } from "@/utils/dateFormatter";
import styles from "./appointments.module.css";

export default function AppointmentsPage() {
  const {
    appointments,
    appointmentsLoading,
    appointmentsError,
    fetchAppointments,
    createAppointment,
    deleteAppointment,
    reminders,
    remindersLoading,
    remindersError,
    fetchReminders,
    createReminder,
    deleteReminder,
  } = useHealth();

  // --- State ---
  const [activeTab, setActiveTab] = useState("upcoming");
  const [showAddAppt, setShowAddAppt] = useState(false);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [deleteApptTarget, setDeleteApptTarget] = useState(null);
  const [deleteReminderTarget, setDeleteReminderTarget] = useState(null);

  // Add appointment form state
  const [apptDoctor, setApptDoctor] = useState("");
  const [apptSpecialty, setApptSpecialty] = useState(SPECIALTIES[0]);
  const [apptDate, setApptDate] = useState("");
  const [apptType, setApptType] = useState("upcoming");
  const [apptNotes, setApptNotes] = useState("");
  const [apptErrors, setApptErrors] = useState({});
  const [apptSubmitting, setApptSubmitting] = useState(false);

  // Add reminder form state
  const [reminderText, setReminderText] = useState("");
  const [reminderTrigger, setReminderTrigger] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [reminderSubmitting, setReminderSubmitting] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchAppointments();
    fetchReminders();
  }, [fetchAppointments, fetchReminders]);

  // Partition appointments by type
  const upcomingAppts = useMemo(
    () => appointments.filter((a) => a.type === "upcoming"),
    [appointments]
  );
  const pastAppts = useMemo(
    () => appointments.filter((a) => a.type === "visited"),
    [appointments]
  );

  const displayedAppts = activeTab === "upcoming" ? upcomingAppts : pastAppts;
  const borderColor = activeTab === "upcoming" ? "#00ff9d" : "#64748b";

  // --- Appointment form handlers ---

  function resetApptForm() {
    setApptDoctor("");
    setApptSpecialty(SPECIALTIES[0]);
    setApptDate("");
    setApptType("upcoming");
    setApptNotes("");
    setApptErrors({});
  }

  function validateApptForm() {
    const errors = {};
    if (!apptDoctor.trim()) {
      errors.doctor = "Doctor name is required";
    }
    if (!apptDate) {
      errors.date = "Date is required";
    }
    return errors;
  }

  async function handleAddAppt(e) {
    e.preventDefault();
    const errors = validateApptForm();
    setApptErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setApptSubmitting(true);
    try {
      await createAppointment({
        doctor: apptDoctor.trim(),
        specialty: apptSpecialty,
        date: apptDate,
        type: apptType,
        notes: apptNotes.trim(),
      });
      setShowAddAppt(false);
      resetApptForm();
    } catch {
      // Error is set in context
    } finally {
      setApptSubmitting(false);
    }
  }

  function handleOpenAddAppt() {
    resetApptForm();
    setShowAddAppt(true);
  }

  // --- Appointment delete handlers ---

  async function confirmDeleteAppt() {
    if (!deleteApptTarget) return;
    setDeleting(true);
    try {
      await deleteAppointment(deleteApptTarget.id);
      setDeleteApptTarget(null);
    } catch {
      // Error is set in context
    } finally {
      setDeleting(false);
    }
  }

  // --- Reminder form handlers ---

  function resetReminderForm() {
    setReminderText("");
    setReminderTrigger("");
    setReminderNotes("");
  }

  async function handleAddReminder(e) {
    e.preventDefault();
    if (!reminderText.trim()) return;

    setReminderSubmitting(true);
    try {
      await createReminder({
        text: reminderText.trim(),
        trigger: reminderTrigger.trim(),
        notes: reminderNotes.trim(),
      });
      setShowAddReminder(false);
      resetReminderForm();
    } catch {
      // Error is set in context
    } finally {
      setReminderSubmitting(false);
    }
  }

  function handleOpenAddReminder() {
    resetReminderForm();
    setShowAddReminder(true);
  }

  // --- Reminder delete handlers ---

  async function confirmDeleteReminder() {
    if (!deleteReminderTarget) return;
    setDeleting(true);
    try {
      await deleteReminder(deleteReminderTarget.id);
      setDeleteReminderTarget(null);
    } catch {
      // Error is set in context
    } finally {
      setDeleting(false);
    }
  }

  // --- Render ---

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">ⓘ</span>
          APPOINTMENTS
        </h1>
        <TButton variant="primary" onClick={handleOpenAddAppt}>
          + ADD VISIT
        </TButton>
      </div>

      {/* Error banners */}
      {appointmentsError && (
        <div className={styles.errorBanner} role="alert">
          {appointmentsError}
        </div>
      )}
      {remindersError && (
        <div className={styles.errorBanner} role="alert">
          {remindersError}
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabList} role="tablist" aria-label="Appointment tabs">
        <button
          type="button"
          role="tab"
          id="tab-upcoming"
          aria-selected={activeTab === "upcoming"}
          aria-controls="tabpanel-upcoming"
          className={`${styles.tab} ${activeTab === "upcoming" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          <span className={styles.tabIcon} aria-hidden="true">▶</span>
          UPCOMING ({upcomingAppts.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-past"
          aria-selected={activeTab === "past"}
          aria-controls="tabpanel-past"
          className={`${styles.tab} ${activeTab === "past" ? styles.tabActive : ""}`}
          onClick={() => setActiveTab("past")}
        >
          <span className={styles.tabIcon} aria-hidden="true">✓</span>
          PAST VISITS ({pastAppts.length})
        </button>
      </div>

      {/* Tab Panel */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        className={styles.tabPanel}
      >
        {appointmentsLoading && (
          <p className={styles.loading}>Loading appointments...</p>
        )}

        {!appointmentsLoading && displayedAppts.length === 0 && (
          <p className={styles.emptyState}>
            {activeTab === "upcoming"
              ? "No upcoming appointments. Click \"+ ADD VISIT\" to schedule one."
              : "No past appointments recorded."}
          </p>
        )}

        {!appointmentsLoading && displayedAppts.length > 0 && (
          <div className={styles.apptList}>
            {displayedAppts.map((appt) => (
              <TCard key={appt.id} accentColor={borderColor}>
                <div className={styles.apptCard}>
                  <button
                    type="button"
                    className={styles.deleteIconBtn}
                    onClick={() => setDeleteApptTarget(appt)}
                    aria-label={`Delete appointment with ${appt.doctor}`}
                  >
                    ✕
                  </button>
                  <div className={styles.apptDoctor}>
                    {appt.doctor.toUpperCase()}
                  </div>
                  <div className={styles.apptMetaRow}>
                    {appt.specialty && (
                      <span className={styles.apptSpecialty}>
                        {appt.specialty.toUpperCase()}
                      </span>
                    )}
                    <span className={styles.apptDate}>
                      <span aria-hidden="true">🕐</span>{" "}
                      {formatShortDate(appt.date)}
                    </span>
                  </div>
                  {appt.notes && (
                    <div className={styles.apptNotes}>{appt.notes}</div>
                  )}
                </div>
              </TCard>
            ))}
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* Maintenance Reminders Section */}
      {/* ========================= */}
      <div className={styles.remindersSection}>
        <div className={styles.remindersHeader}>
          <h2 className={styles.remindersTitle}>
            <span className={styles.remindersTitleIcon} aria-hidden="true">⚠</span>
            MAINTENANCE REMINDERS
          </h2>
          <TButton variant="secondary" onClick={handleOpenAddReminder}>
            + ADD
          </TButton>
        </div>

        {remindersLoading && (
          <p className={styles.loading}>Loading reminders...</p>
        )}

        {!remindersLoading && reminders.length === 0 && (
          <p className={styles.emptyState}>
            No reminders yet. Add one to stay on top of routine checkups.
          </p>
        )}

        {!remindersLoading && reminders.length > 0 && (
          <div className={styles.reminderList}>
            {reminders.map((reminder) => (
              <TCard key={reminder.id} accentColor="#ffaa00">
                <div className={styles.reminderCard}>
                  <button
                    type="button"
                    className={styles.deleteIconBtn}
                    onClick={() => setDeleteReminderTarget(reminder)}
                    aria-label={`Delete reminder: ${reminder.text}`}
                  >
                    ✕
                  </button>
                  <span className={styles.reminderIcon} aria-hidden="true">⏰</span>
                  <div className={styles.reminderBody}>
                    <div className={styles.reminderText}>
                      {reminder.text.toUpperCase()}
                    </div>
                    {reminder.trigger && (
                      <div className={styles.reminderTrigger}>
                        TRIGGER: {reminder.trigger}
                      </div>
                    )}
                    {reminder.notes && (
                      <div className={styles.reminderNotes}>{reminder.notes}</div>
                    )}
                  </div>
                </div>
              </TCard>
            ))}
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* Add Appointment Modal */}
      {/* ========================= */}
      <HealthModal
        isOpen={showAddAppt}
        onClose={() => setShowAddAppt(false)}
        title="Add Appointment"
      >
        <form onSubmit={handleAddAppt} className={styles.modalForm}>
          <TInput
            id="appt-doctor"
            label="Doctor"
            value={apptDoctor}
            onChange={(e) => setApptDoctor(e.target.value)}
            error={apptErrors.doctor}
            placeholder="Dr. Smith"
          />
          <TSelect
            id="appt-specialty"
            label="Specialty"
            value={apptSpecialty}
            onChange={(e) => setApptSpecialty(e.target.value)}
          >
            {SPECIALTIES.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </TSelect>
          <TInput
            id="appt-date"
            label="Date"
            type="date"
            value={apptDate}
            onChange={(e) => setApptDate(e.target.value)}
            error={apptErrors.date}
          />

          {/* Type toggle */}
          <div>
            <label
              className={styles.reminderText}
              style={{ marginBottom: 6, display: "block" }}
            >
              Type
            </label>
            <div className={styles.typeToggle}>
              <button
                type="button"
                className={`${styles.typeBtn} ${apptType === "upcoming" ? styles.typeBtnActive : ""}`}
                onClick={() => setApptType("upcoming")}
                aria-pressed={apptType === "upcoming"}
              >
                Upcoming
              </button>
              <button
                type="button"
                className={`${styles.typeBtn} ${apptType === "visited" ? styles.typeBtnActive : ""}`}
                onClick={() => setApptType("visited")}
                aria-pressed={apptType === "visited"}
              >
                Past Visit
              </button>
            </div>
          </div>

          <TTextarea
            id="appt-notes"
            label="Notes"
            rows={3}
            value={apptNotes}
            onChange={(e) => setApptNotes(e.target.value)}
            placeholder="Optional notes..."
          />

          <div className={styles.modalActions}>
            <TButton
              variant="ghost"
              onClick={() => setShowAddAppt(false)}
            >
              CANCEL
            </TButton>
            <TButton
              variant="primary"
              type="submit"
              disabled={apptSubmitting}
            >
              {apptSubmitting ? "SAVING..." : "SAVE"}
            </TButton>
          </div>
        </form>
      </HealthModal>

      {/* ========================= */}
      {/* Delete Appointment Confirmation Modal */}
      {/* ========================= */}
      <HealthModal
        isOpen={deleteApptTarget !== null}
        onClose={() => setDeleteApptTarget(null)}
        title="Confirm Delete"
      >
        <p>
          Are you sure you want to delete the appointment with{" "}
          <strong>{deleteApptTarget ? deleteApptTarget.doctor : ""}</strong>?
          This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeleteApptTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDeleteAppt} disabled={deleting}>
            {deleting ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>

      {/* ========================= */}
      {/* Add Reminder Modal */}
      {/* ========================= */}
      <HealthModal
        isOpen={showAddReminder}
        onClose={() => setShowAddReminder(false)}
        title="Add Reminder"
      >
        <form onSubmit={handleAddReminder} className={styles.modalForm}>
          <TInput
            id="reminder-text"
            label="Reminder"
            value={reminderText}
            onChange={(e) => setReminderText(e.target.value)}
            placeholder="Annual physical exam"
          />
          <TInput
            id="reminder-trigger"
            label="Trigger"
            value={reminderTrigger}
            onChange={(e) => setReminderTrigger(e.target.value)}
            placeholder="Every 12 months"
          />
          <TTextarea
            id="reminder-notes"
            label="Notes"
            rows={2}
            value={reminderNotes}
            onChange={(e) => setReminderNotes(e.target.value)}
            placeholder="Optional notes..."
          />

          <div className={styles.modalActions}>
            <TButton
              variant="ghost"
              onClick={() => setShowAddReminder(false)}
            >
              CANCEL
            </TButton>
            <TButton
              variant="primary"
              type="submit"
              disabled={reminderSubmitting}
            >
              {reminderSubmitting ? "SAVING..." : "SAVE"}
            </TButton>
          </div>
        </form>
      </HealthModal>

      {/* ========================= */}
      {/* Delete Reminder Confirmation Modal */}
      {/* ========================= */}
      <HealthModal
        isOpen={deleteReminderTarget !== null}
        onClose={() => setDeleteReminderTarget(null)}
        title="Confirm Delete"
      >
        <p>
          Are you sure you want to delete the reminder{" "}
          <strong>{deleteReminderTarget ? deleteReminderTarget.text : ""}</strong>?
          This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeleteReminderTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDeleteReminder} disabled={deleting}>
            {deleting ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>
    </div>
  );
}

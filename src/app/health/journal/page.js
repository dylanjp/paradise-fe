"use client";

/**
 * Daily Journal Screen
 * Two views: Entry form for logging daily health data, and History list
 * with expandable accordion entries, delete confirmation, and CSV export.
 *
 * Requirements: 2.1–2.10, 3.1–3.3
 */

import { useState, useEffect, useMemo } from "react";
import { useHealth } from "@/src/context/HealthContext";
import { MOOD_LEVELS } from "@/utils/healthConstants";
import TCard from "@/components/TCard";
import TButton from "@/components/TButton";
import TInput from "@/components/TInput";
import TSelect from "@/components/TSelect";
import TTextarea from "@/components/TTextarea";
import HealthModal from "@/components/HealthModal";
import { calculateSleepDuration } from "@/utils/sleepCalculator";
import { ENERGY_LEVELS } from "@/utils/healthConstants";
import { formatShortDate } from "@/utils/dateFormatter";
import { exportJournalCSV, triggerDownload } from "@/utils/csvExporter";
import styles from "./journal.module.css";

const INITIAL_FORM = {
  date: "",
  weight: "",
  bedTime: "",
  wakeTime: "",
  energy: "",
  mood: "",
  thoughts: "",
};

export default function JournalPage() {
  const {
    journalEntries,
    journalLoading,
    journalError,
    fetchJournalEntries,
    saveJournalEntry,
    deleteJournalEntry,
  } = useHealth();

  // View state: "form" or "history"
  const [view, setView] = useState("form");

  // Form state
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // History state
  const [expandedId, setExpandedId] = useState(null);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch entries on mount
  useEffect(() => {
    fetchJournalEntries();
  }, [fetchJournalEntries]);

  // Computed sleep duration
  const sleepDuration = useMemo(() => {
    if (form.bedTime && form.wakeTime) {
      return calculateSleepDuration(form.bedTime, form.wakeTime);
    }
    return null;
  }, [form.bedTime, form.wakeTime]);

  // Sorted entries (reverse chronological)
  const sortedEntries = useMemo(() => {
    return [...journalEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [journalEntries]);

  // --- Form handlers ---

  function handleFieldChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field on change
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate() {
    const newErrors = {};
    if (!form.date) newErrors.date = "Date is required";
    if (form.energy === "") newErrors.energy = "Energy level is required";
    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const entry = {
        date: form.date,
        weightLbs: form.weight !== "" ? Number(form.weight) : null,
        bedTime: form.bedTime || null,
        wakeTime: form.wakeTime || null,
        energy: Number(form.energy),
        mood: form.mood !== "" ? Number(form.mood) : null,
        thoughts: form.thoughts,
      };
      await saveJournalEntry(entry);
      setSuccessMsg("✓ ENTRY SAVED");
      setForm(INITIAL_FORM);
      setTimeout(() => {
        setSuccessMsg("");
        setView("history");
      }, 900);
    } catch {
      // Error is set in context
    } finally {
      setSaving(false);
    }
  }

  // --- History handlers ---

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleDeleteClick(entry) {
    setDeleteTarget(entry);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteJournalEntry(deleteTarget.id);
      setDeleteTarget(null);
      setExpandedId(null);
    } catch {
      // Error is set in context
    } finally {
      setDeleting(false);
    }
  }

  function handleExport() {
    const csv = exportJournalCSV(journalEntries);
    const today = new Date().toISOString().slice(0, 10);
    triggerDownload(csv, `health_journal_${today}.csv`);
  }

  // --- Render ---

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>DAILY JOURNAL</h1>
        <div className={styles.viewToggle}>
          <TButton
            variant={view === "form" ? "primary" : "ghost"}
            onClick={() => setView("form")}
            ariaLabel="Switch to entry form"
          >
            Entry
          </TButton>
          <TButton
            variant={view === "history" ? "primary" : "ghost"}
            onClick={() => setView("history")}
            ariaLabel="Switch to history view"
          >
            History
          </TButton>
          {view === "history" && journalEntries.length > 0 && (
            <TButton variant="secondary" onClick={handleExport} ariaLabel="Export journal entries as CSV">
              ⬇ EXPORT
            </TButton>
          )}
        </div>
      </div>

      {/* Error banner */}
      {journalError && (
        <div className={styles.errorBanner} role="alert">
          {journalError}
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <p className={styles.successMsg} role="status">
          {successMsg}
        </p>
      )}

      {/* Entry Form View */}
      {view === "form" && (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formRow}>
            <TInput
              id="journal-date"
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => handleFieldChange("date", e.target.value)}
              error={errors.date}
            />
            <TInput
              id="journal-weight"
              label="Weight (lbs)"
              type="number"
              step="0.1"
              min="0"
              value={form.weight}
              onChange={(e) => handleFieldChange("weight", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className={styles.formRow}>
            <TInput
              id="journal-bedtime"
              label="Bed Time"
              type="time"
              value={form.bedTime}
              onChange={(e) => handleFieldChange("bedTime", e.target.value)}
              placeholder="Optional"
            />
            <TInput
              id="journal-waketime"
              label="Wake Time"
              type="time"
              value={form.wakeTime}
              onChange={(e) => handleFieldChange("wakeTime", e.target.value)}
              placeholder="Optional"
            />
          </div>

          {sleepDuration && (
            <div className={styles.sleepDisplay} aria-live="polite">
              SLEEP: {sleepDuration}
            </div>
          )}

          <TSelect
            id="journal-energy"
            label="Energy Level"
            value={form.energy}
            onChange={(e) => handleFieldChange("energy", e.target.value)}
            error={errors.energy}
          >
            <option value="" disabled>
              Select energy level
            </option>
            {ENERGY_LEVELS.map((level, idx) => (
              <option key={idx} value={idx}>
                {level.emoji} {level.label}
              </option>
            ))}
          </TSelect>

          <TSelect
            id="journal-mood"
            label="Mood (1-5)"
            value={form.mood}
            onChange={(e) => handleFieldChange("mood", e.target.value)}
          >
            <option value="">No mood logged</option>
            {MOOD_LEVELS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </TSelect>

          <TTextarea
            id="journal-thoughts"
            label="Thoughts"
            rows={4}
            value={form.thoughts}
            onChange={(e) => handleFieldChange("thoughts", e.target.value)}
            placeholder="How are you feeling today?"
          />

          <div className={styles.actions}>
            <TButton type="submit" disabled={saving}>
              {saving ? "SAVING..." : "SAVE ENTRY"}
            </TButton>
          </div>
        </form>
      )}

      {/* History View */}
      {view === "history" && (
        <>
          {journalLoading && (
            <p className={styles.loading}>Loading entries...</p>
          )}

          {!journalLoading && sortedEntries.length === 0 && (
            <p className={styles.emptyState}>
              No journal entries yet. Switch to the Entry view to log your first entry.
            </p>
          )}

          {!journalLoading && sortedEntries.length > 0 && (
            <div className={styles.historyList}>
              {sortedEntries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const energyInfo = ENERGY_LEVELS[entry.energy];

                return (
                  <TCard key={entry.id}>
                    <div
                      className={styles.entryHeader}
                      onClick={() => toggleExpand(entry.id)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(entry.id);
                        }
                      }}
                    >
                      <div>
                        <span className={styles.entryDate}>
                          {formatShortDate(entry.date)}
                        </span>
                        <span className={styles.entrySummary}>
                          {" "}— {energyInfo?.emoji} {energyInfo?.label}
                        </span>
                      </div>
                      <span
                        className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ""}`}
                        aria-hidden="true"
                      >
                        ▶
                      </span>
                    </div>

                    {isExpanded && (
                      <div className={styles.entryDetails}>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Date:</span>
                          <span className={styles.detailValue}>
                            {formatShortDate(entry.date)}
                          </span>
                        </div>
                        {entry.weightLbs != null && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Weight:</span>
                            <span className={styles.detailValue}>
                              {entry.weightLbs} lbs
                            </span>
                          </div>
                        )}
                        {entry.bedTime && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Bed Time:</span>
                            <span className={styles.detailValue}>
                              {entry.bedTime}
                            </span>
                          </div>
                        )}
                        {entry.wakeTime && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Wake Time:</span>
                            <span className={styles.detailValue}>
                              {entry.wakeTime}
                            </span>
                          </div>
                        )}
                        {entry.bedTime && entry.wakeTime && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Sleep:</span>
                            <span className={styles.detailValue}>
                              {calculateSleepDuration(entry.bedTime, entry.wakeTime)}
                            </span>
                          </div>
                        )}
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Energy:</span>
                          <span className={styles.detailValue}>
                            {energyInfo?.emoji} {energyInfo?.label}
                          </span>
                        </div>
                        {entry.mood != null && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Mood:</span>
                            <span className={styles.detailValue}>
                              {entry.mood} / 5
                            </span>
                          </div>
                        )}
                        {entry.thoughts && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>Thoughts:</span>
                            <span className={styles.detailValue}>
                              {entry.thoughts}
                            </span>
                          </div>
                        )}
                        <div className={styles.actions}>
                          <TButton
                            variant="danger"
                            onClick={() => handleDeleteClick(entry)}
                            ariaLabel={`Delete entry for ${formatShortDate(entry.date)}`}
                          >
                            DELETE
                          </TButton>
                        </div>
                      </div>
                    )}
                  </TCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      <HealthModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
      >
        <p>
          Are you sure you want to delete the journal entry for{" "}
          <strong>
            {deleteTarget ? formatShortDate(deleteTarget.date) : ""}
          </strong>
          ? This action cannot be undone.
        </p>
        <div className={styles.modalActions}>
          <TButton variant="ghost" onClick={() => setDeleteTarget(null)}>
            CANCEL
          </TButton>
          <TButton variant="danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? "DELETING..." : "DELETE"}
          </TButton>
        </div>
      </HealthModal>
    </div>
  );
}

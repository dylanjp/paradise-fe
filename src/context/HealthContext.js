"use client";

/**
 * Health Context Module
 * Provides centralized state management for all five Health Portal data domains:
 * journal entries, metrics, documents, appointments, and reminders.
 *
 * Each domain has independent data, loading, and error state.
 * Data is fetched lazily — pages call fetch* on mount, context caches results.
 * Mutations: call healthService → update local state on success → set error on failure.
 *
 * Requirements: 2.2, 2.3, 2.6, 4.1, 4.5, 4.6, 5.3, 5.4, 5.7, 7.2, 7.5, 7.6, 8.2, 8.4, 8.5
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import { healthService } from "../lib/healthService";
import { useAuth } from "../context/AuthContext";

// Create the Health Context
const HealthContext = createContext(null);

/**
 * HealthProvider component that wraps health routes and provides data state
 * @param {object} props - Component props
 * @param {React.ReactNode} props.children - Child components
 */
export function HealthProvider({ children }) {
  const { username } = useAuth();

  // --- Journal State ---
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(null);

  // --- Metrics State ---
  const [metrics, setMetrics] = useState([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState(null);

  // --- Documents State ---
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);

  // --- Appointments State ---
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState(null);

  // --- Reminders State ---
  const [reminders, setReminders] = useState([]);
  const [remindersLoading, setRemindersLoading] = useState(false);
  const [remindersError, setRemindersError] = useState(null);

  // =====================
  // Journal Functions
  // =====================

  /**
   * Fetches all journal entries from the API.
   * Lazy fetch: pages call this on mount, context caches the result.
   * Requirement 2.3
   */
  const fetchJournalEntries = useCallback(async () => {
    setJournalLoading(true);
    setJournalError(null);
    try {
      const data = await healthService.getJournalEntries(username);
      setJournalEntries(data);
    } catch (error) {
      setJournalError(error.message);
    } finally {
      setJournalLoading(false);
    }
  }, []);

  /**
   * Saves a journal entry (upsert). If the entry has an id, updates it.
   * Otherwise, checks if an entry with the same date exists (upsert by date).
   * If no match, creates a new entry.
   * Requirements: 2.2, 2.6
   */
  const saveJournalEntry = useCallback(async (entry) => {
    setJournalError(null);
    try {
      let savedEntry;

      if (entry.id) {
        // Update existing entry by id
        savedEntry = await healthService.updateJournalEntry(username, entry.id, entry);
        setJournalEntries((prev) =>
          prev.map((e) => (e.id === savedEntry.id ? savedEntry : e))
        );
      } else {
        // Check if an entry with the same date already exists (upsert by date)
        const existing = journalEntries.find((e) => e.date === entry.date);
        if (existing) {
          savedEntry = await healthService.updateJournalEntry(username, existing.id, entry);
          setJournalEntries((prev) =>
            prev.map((e) => (e.id === savedEntry.id ? savedEntry : e))
          );
        } else {
          savedEntry = await healthService.createJournalEntry(username, entry);
          setJournalEntries((prev) => [savedEntry, ...prev]);
        }
      }
    } catch (error) {
      setJournalError(error.message);
      throw error;
    }
  }, [journalEntries]);

  /**
   * Deletes a journal entry. Optimistic removal from local state, then API call.
   * Requirement 2.6
   */
  const deleteJournalEntry = useCallback(async (id) => {
    setJournalError(null);
    const previousEntries = journalEntries;
    // Optimistic removal
    setJournalEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await healthService.deleteJournalEntry(username, id);
    } catch (error) {
      // Rollback on failure
      setJournalEntries(previousEntries);
      setJournalError(error.message);
      throw error;
    }
  }, [journalEntries]);

  // =====================
  // Metrics Functions
  // =====================

  /**
   * Fetches all health metrics from the API.
   * Requirement 4.1
   */
  const fetchMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const data = await healthService.getMetrics(username);
      setMetrics(data);
    } catch (error) {
      setMetricsError(error.message);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  /**
   * Creates a new health metric.
   * Requirements: 4.5, 4.6
   */
  const createMetric = useCallback(async (metric) => {
    setMetricsError(null);
    try {
      const savedMetric = await healthService.createMetric(username, metric);
      setMetrics((prev) => [...prev, savedMetric]);
    } catch (error) {
      setMetricsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Adds a data point to an existing metric.
   * Requirement 4.6
   */
  const addDataPoint = useCallback(async (metricId, point) => {
    setMetricsError(null);
    try {
      const updatedMetric = await healthService.addDataPoint(username, metricId, point);
      setMetrics((prev) =>
        prev.map((m) => (m.id === metricId ? updatedMetric : m))
      );
    } catch (error) {
      setMetricsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Updates an existing metric's settings (name, unit, colors).
   */
  const updateMetric = useCallback(async (metricId, metric) => {
    setMetricsError(null);
    try {
      const updatedMetric = await healthService.updateMetric(username, metricId, metric);
      setMetrics((prev) =>
        prev.map((m) => (m.id === metricId ? updatedMetric : m))
      );
    } catch (error) {
      setMetricsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Updates the data point at the given index on a metric.
   * The API returns the full updated metric, which replaces the one in state.
   */
  const updateDataPoint = useCallback(async (metricId, index, point) => {
    setMetricsError(null);
    try {
      const updatedMetric = await healthService.updateDataPoint(username, metricId, index, point);
      setMetrics((prev) =>
        prev.map((m) => (m.id === metricId ? updatedMetric : m))
      );
    } catch (error) {
      setMetricsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Deletes the data point at the given index on a metric.
   * The API returns the updated metric, which replaces the one in state.
   */
  const deleteDataPoint = useCallback(async (metricId, index) => {
    setMetricsError(null);
    try {
      const updatedMetric = await healthService.deleteDataPoint(username, metricId, index);
      setMetrics((prev) =>
        prev.map((m) => (m.id === metricId ? updatedMetric : m))
      );
    } catch (error) {
      setMetricsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Deletes a whole metric. Optimistic removal from local state, rollback on failure.
   */
  const deleteMetric = useCallback(async (metricId) => {
    setMetricsError(null);
    const previousMetrics = metrics;
    // Optimistic removal
    setMetrics((prev) => prev.filter((m) => m.id !== metricId));
    try {
      await healthService.deleteMetric(username, metricId);
    } catch (error) {
      // Rollback on failure
      setMetrics(previousMetrics);
      setMetricsError(error.message);
      throw error;
    }
  }, [metrics]);

  // =====================
  // Documents Functions
  // =====================

  /**
   * Fetches all health documents from the API.
   * Requirement 5.4
   */
  const fetchDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const data = await healthService.getDocuments(username);
      setDocuments(data);
    } catch (error) {
      setDocumentsError(error.message);
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  /**
   * Uploads a document via multipart form data.
   * Requirements: 5.3, 5.7
   */
  const uploadDocument = useCallback(async (file, category) => {
    setDocumentsError(null);
    try {
      const savedDoc = await healthService.uploadDocument(username, file, category);
      setDocuments((prev) => [...prev, savedDoc]);
    } catch (error) {
      setDocumentsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Downloads a document's file bytes (Blob) via the authenticated endpoint.
   * Read-only — does not touch documents state; the caller turns the Blob into
   * an object URL to trigger the browser download.
   */
  const downloadDocument = useCallback(async (id) => {
    setDocumentsError(null);
    try {
      return await healthService.downloadDocument(username, id);
    } catch (error) {
      setDocumentsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Deletes a health document. Optimistic removal from local state.
   * Requirement 5.7
   */
  const deleteDocument = useCallback(async (id) => {
    setDocumentsError(null);
    const previousDocs = documents;
    // Optimistic removal
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    try {
      await healthService.deleteDocument(username, id);
    } catch (error) {
      // Rollback on failure
      setDocuments(previousDocs);
      setDocumentsError(error.message);
      throw error;
    }
  }, [documents]);

  // =====================
  // Appointments Functions
  // =====================

  /**
   * Fetches all appointments from the API.
   * Requirement 7.2
   */
  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const data = await healthService.getAppointments(username);
      setAppointments(data);
    } catch (error) {
      setAppointmentsError(error.message);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  /**
   * Creates a new appointment.
   * Requirements: 7.5, 7.6
   */
  const createAppointment = useCallback(async (appointment) => {
    setAppointmentsError(null);
    try {
      const savedAppt = await healthService.createAppointment(username, appointment);
      setAppointments((prev) => [...prev, savedAppt]);
    } catch (error) {
      setAppointmentsError(error.message);
      throw error;
    }
  }, []);

  /**
   * Deletes an appointment. Optimistic removal from local state.
   * Requirement 7.6
   */
  const deleteAppointment = useCallback(async (id) => {
    setAppointmentsError(null);
    const previousAppts = appointments;
    // Optimistic removal
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    try {
      await healthService.deleteAppointment(username, id);
    } catch (error) {
      // Rollback on failure
      setAppointments(previousAppts);
      setAppointmentsError(error.message);
      throw error;
    }
  }, [appointments]);

  // =====================
  // Reminders Functions
  // =====================

  /**
   * Fetches all health maintenance reminders from the API.
   * Requirement 8.2
   */
  const fetchReminders = useCallback(async () => {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const data = await healthService.getReminders(username);
      setReminders(data);
    } catch (error) {
      setRemindersError(error.message);
    } finally {
      setRemindersLoading(false);
    }
  }, []);

  /**
   * Creates a new reminder.
   * Requirements: 8.4, 8.5
   */
  const createReminder = useCallback(async (reminder) => {
    setRemindersError(null);
    try {
      const savedReminder = await healthService.createReminder(username, reminder);
      setReminders((prev) => [...prev, savedReminder]);
    } catch (error) {
      setRemindersError(error.message);
      throw error;
    }
  }, []);

  /**
   * Deletes a reminder. Optimistic removal from local state.
   * Requirement 8.5
   */
  const deleteReminder = useCallback(async (id) => {
    setRemindersError(null);
    const previousReminders = reminders;
    // Optimistic removal
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      await healthService.deleteReminder(username, id);
    } catch (error) {
      // Rollback on failure
      setReminders(previousReminders);
      setRemindersError(error.message);
      throw error;
    }
  }, [reminders]);

  // Context value with all state and functions
  const contextValue = {
    // Journal
    journalEntries,
    journalLoading,
    journalError,
    fetchJournalEntries,
    saveJournalEntry,
    deleteJournalEntry,

    // Metrics
    metrics,
    metricsLoading,
    metricsError,
    fetchMetrics,
    createMetric,
    addDataPoint,
    updateMetric,
    deleteMetric,
    updateDataPoint,
    deleteDataPoint,

    // Documents
    documents,
    documentsLoading,
    documentsError,
    fetchDocuments,
    uploadDocument,
    downloadDocument,
    deleteDocument,

    // Appointments
    appointments,
    appointmentsLoading,
    appointmentsError,
    fetchAppointments,
    createAppointment,
    deleteAppointment,

    // Reminders
    reminders,
    remindersLoading,
    remindersError,
    fetchReminders,
    createReminder,
    deleteReminder,
  };

  return (
    <HealthContext.Provider value={contextValue}>
      {children}
    </HealthContext.Provider>
  );
}

/**
 * Custom hook to access health context
 * @returns {HealthContextValue} Health context value
 * @throws {Error} If used outside of HealthProvider
 */
export function useHealth() {
  const context = useContext(HealthContext);

  if (context === null) {
    throw new Error("useHealth must be used within a HealthProvider");
  }

  return context;
}

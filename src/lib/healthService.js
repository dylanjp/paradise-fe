/**
 * Health Service Module
 * Centralized API service for all Health Portal endpoints under /api/health/*.
 * Uses the existing apiClient for JSON requests and fetch directly for multipart uploads.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */

import apiClient from "./apiClient";
import { getToken } from "./tokenStorage";
import { handleUnauthorized } from "./apiClient";

function getBase(username) {
  return `/users/${username}/health`;
}

/**
 * Transforms API errors into user-friendly error messages.
 * @param {Error} error - The original error
 * @param {string} operation - Description of the failed operation
 * @returns {Error} A new Error with a user-friendly message
 */
function handleError(error, operation) {
  if (error.name === "TypeError" && error.message === "Failed to fetch") {
    return new Error("Unable to connect to server. Please try again.");
  }
  if (error.status === 404) return new Error("Resource not found.");
  if (error.status === 400) {
    const message = error.data?.message || error.message || "Invalid request";
    const err = new Error(message);
    if (error.data?.errorCode) {
      err.errorCode = error.data.errorCode;
    }
    return err;
  }
  if (error.status >= 500) return new Error("Server error. Please try again later.");
  return new Error(`Failed to ${operation}. Please try again.`);
}

/**
 * Normalizes a document record from the API so the UI never receives undefined
 * display fields. A single malformed record (e.g. one missing `date`) must not be
 * able to crash the documents list during render.
 * @param {Object} doc - Raw document object from the API
 * @param {Object} [options]
 * @param {string} [options.fallbackDate] - Date (YYYY-MM-DD) to use when the record has none
 * @returns {Object} Document with safe display fields
 */
function normalizeDocument(doc, { fallbackDate } = {}) {
  const safeDoc = doc && typeof doc === "object" ? doc : {};
  const hasValidDate =
    typeof safeDoc.date === "string" && safeDoc.date.trim() !== "";
  return {
    ...safeDoc,
    name: safeDoc.name || "Untitled document",
    category: safeDoc.category || "Other",
    date: hasValidDate ? safeDoc.date : (fallbackDate ?? null),
    size: safeDoc.size || "—",
    url: safeDoc.url || null,
  };
}

export const healthService = {
  // --- Journal Entries ---

  /**
   * Fetches all journal entries.
   * @returns {Promise<Array>} Array of journal entry objects
   */
  getJournalEntries: async (username) => {
    try {
      return await apiClient.get(`${getBase(username)}/journal`);
    } catch (error) {
      throw handleError(error, "fetch journal entries");
    }
  },

  /**
   * Creates a new journal entry.
   * @param {Object} entry - Journal entry data
   * @returns {Promise<Object>} The created journal entry
   */
  createJournalEntry: async (username, entry) => {
    try {
      return await apiClient.post(`${getBase(username)}/journal`, entry);
    } catch (error) {
      throw handleError(error, "save journal entry");
    }
  },

  /**
   * Updates an existing journal entry.
   * @param {string} id - Journal entry ID
   * @param {Object} entry - Updated journal entry data
   * @returns {Promise<Object>} The updated journal entry
   */
  updateJournalEntry: async (username, id, entry) => {
    try {
      return await apiClient.put(`${getBase(username)}/journal/${id}`, entry);
    } catch (error) {
      throw handleError(error, "update journal entry");
    }
  },

  /**
   * Deletes a journal entry.
   * @param {string} id - Journal entry ID
   * @returns {Promise<void>}
   */
  deleteJournalEntry: async (username, id) => {
    try {
      return await apiClient.delete(`${getBase(username)}/journal/${id}`);
    } catch (error) {
      throw handleError(error, "delete journal entry");
    }
  },

  // --- Metrics ---

  /**
   * Fetches all health metrics.
   * @returns {Promise<Array>} Array of metric objects
   */
  getMetrics: async (username) => {
    try {
      return await apiClient.get(`${getBase(username)}/metrics`);
    } catch (error) {
      throw handleError(error, "fetch metrics");
    }
  },

  /**
   * Creates a new health metric.
   * @param {Object} metric - Metric data (name, type, unit, color)
   * @returns {Promise<Object>} The created metric
   */
  createMetric: async (username, metric) => {
    try {
      return await apiClient.post(`${getBase(username)}/metrics`, metric);
    } catch (error) {
      throw handleError(error, "create metric");
    }
  },

  /**
   * Adds a data point to an existing metric.
   * @param {string} metricId - Metric ID
   * @param {Object} point - Data point (label, value)
   * @returns {Promise<Object>} The updated metric or data point
   */
  addDataPoint: async (username, metricId, point) => {
    try {
      return await apiClient.post(`${getBase(username)}/metrics/${metricId}/points`, point);
    } catch (error) {
      throw handleError(error, "add data point");
    }
  },

  /**
   * Updates an existing metric's settings (name, unit, colors).
   * @param {string} metricId - Metric ID
   * @param {Object} metric - { name, unit, colors }
   * @returns {Promise<Object>} The updated metric
   */
  updateMetric: async (username, metricId, metric) => {
    try {
      return await apiClient.put(`${getBase(username)}/metrics/${metricId}`, metric);
    } catch (error) {
      throw handleError(error, "update metric");
    }
  },

  /**
   * Deletes a metric.
   * @param {string} metricId - Metric ID
   * @returns {Promise<void>}
   */
  deleteMetric: async (username, metricId) => {
    try {
      return await apiClient.delete(`${getBase(username)}/metrics/${metricId}`);
    } catch (error) {
      throw handleError(error, "delete metric");
    }
  },

  /**
   * Updates the data point at the given index on a metric.
   * @param {string} metricId - Metric ID
   * @param {number} index - 0-based point index (label-sorted order)
   * @param {Object} point - Data point payload ({ label, value } or { label, values })
   * @returns {Promise<Object>} The updated metric
   */
  updateDataPoint: async (username, metricId, index, point) => {
    try {
      return await apiClient.put(`${getBase(username)}/metrics/${metricId}/points/${index}`, point);
    } catch (error) {
      throw handleError(error, "update data point");
    }
  },

  /**
   * Deletes the data point at the given index on a metric.
   * @param {string} metricId - Metric ID
   * @param {number} index - 0-based point index (label-sorted order)
   * @returns {Promise<Object>} The updated metric
   */
  deleteDataPoint: async (username, metricId, index) => {
    try {
      return await apiClient.delete(`${getBase(username)}/metrics/${metricId}/points/${index}`);
    } catch (error) {
      throw handleError(error, "delete data point");
    }
  },

  // --- Documents ---

  /**
   * Fetches all health documents.
   * @returns {Promise<Array>} Array of document objects
   */
  getDocuments: async (username) => {
    try {
      const data = await apiClient.get(`${getBase(username)}/documents`);
      return Array.isArray(data) ? data.map((doc) => normalizeDocument(doc)) : [];
    } catch (error) {
      throw handleError(error, "fetch documents");
    }
  },

  /**
   * Uploads a document using multipart form data.
   * Uses fetch directly instead of apiClient to support FormData.
   * Requirement 13.4: Multipart upload bypassing default JSON content-type.
   * @param {File} file - The file to upload
   * @param {string} category - Document category
   * @returns {Promise<Object>} The created document record
   */
  uploadDocument: async (username, file, category) => {
    const today = new Date().toISOString().slice(0, 10);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("date", today);

    const token = getToken();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL}${getBase(username)}/documents`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        // No Content-Type header — browser sets multipart boundary automatically
        body: formData,
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Session expired");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Upload failed");
    }

    return normalizeDocument(await response.json(), { fallbackDate: today });
  },

  /**
   * Downloads a document's file bytes via the authenticated streaming endpoint.
   * The document record carries no public URL — bytes are served only behind
   * auth at GET /documents/{id}/download — so this fetches with the Bearer token
   * and returns a Blob the caller can turn into an object URL.
   * Uses fetch directly (not apiClient) because the response is binary, not JSON.
   * @param {string} id - Document ID
   * @returns {Promise<Blob>} The file contents
   */
  downloadDocument: async (username, id) => {
    const token = getToken();
    let response;
    try {
      response = await fetch(
        `${process.env.NEXT_PUBLIC_PARADISE_API_BASE_URL}${getBase(username)}/documents/${id}/download`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
    } catch (error) {
      throw handleError(error, "download document");
    }

    if (!response.ok) {
      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Session expired");
      }
      const errorData = await response.json().catch(() => ({}));
      throw handleError(
        { status: response.status, data: errorData, message: errorData.message },
        "download document"
      );
    }

    return response.blob();
  },

  /**
   * Deletes a health document.
   * @param {string} id - Document ID
   * @returns {Promise<void>}
   */
  deleteDocument: async (username, id) => {
    try {
      return await apiClient.delete(`${getBase(username)}/documents/${id}`);
    } catch (error) {
      throw handleError(error, "delete document");
    }
  },

  // --- Appointments ---

  /**
   * Fetches all appointments.
   * @returns {Promise<Array>} Array of appointment objects
   */
  getAppointments: async (username) => {
    try {
      return await apiClient.get(`${getBase(username)}/appointments`);
    } catch (error) {
      throw handleError(error, "fetch appointments");
    }
  },

  /**
   * Creates a new appointment.
   * @param {Object} appointment - Appointment data (doctor, specialty, date, type, notes)
   * @returns {Promise<Object>} The created appointment
   */
  createAppointment: async (username, appointment) => {
    try {
      return await apiClient.post(`${getBase(username)}/appointments`, appointment);
    } catch (error) {
      throw handleError(error, "create appointment");
    }
  },

  /**
   * Deletes an appointment.
   * @param {string} id - Appointment ID
   * @returns {Promise<void>}
   */
  deleteAppointment: async (username, id) => {
    try {
      return await apiClient.delete(`${getBase(username)}/appointments/${id}`);
    } catch (error) {
      throw handleError(error, "delete appointment");
    }
  },

  // --- Reminders ---

  /**
   * Fetches all health maintenance reminders.
   * @returns {Promise<Array>} Array of reminder objects
   */
  getReminders: async (username) => {
    try {
      return await apiClient.get(`${getBase(username)}/reminders`);
    } catch (error) {
      throw handleError(error, "fetch reminders");
    }
  },

  /**
   * Creates a new reminder.
   * @param {Object} reminder - Reminder data (text, trigger, notes)
   * @returns {Promise<Object>} The created reminder
   */
  createReminder: async (username, reminder) => {
    try {
      return await apiClient.post(`${getBase(username)}/reminders`, reminder);
    } catch (error) {
      throw handleError(error, "create reminder");
    }
  },

  /**
   * Deletes a reminder.
   * @param {string} id - Reminder ID
   * @returns {Promise<void>}
   */
  deleteReminder: async (username, id) => {
    try {
      return await apiClient.delete(`${getBase(username)}/reminders/${id}`);
    } catch (error) {
      throw handleError(error, "delete reminder");
    }
  },
};

/**
 * CSV export utilities for the Health Portal.
 * Provides serialization of JournalEntry and HealthDoc arrays to CSV,
 * and a browser download trigger.
 */

import { calculateSleepDuration } from "./sleepCalculator.js";
import { ENERGY_LEVELS } from "./healthConstants.js";

/**
 * Escapes a CSV field value. If the value contains commas, double quotes,
 * or newlines, it is wrapped in double quotes with internal quotes doubled.
 * @param {string} value - The field value to escape
 * @returns {string} The escaped CSV field
 */
export function escapeCSVField(value) {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Serializes an array of JournalEntry objects to a CSV string.
 * Columns: Date, Weight(lbs), Bedtime, Wake, Sleep (computed), Energy (named label), Thoughts
 *
 * @param {Array<{id: string, date: string, weight: number|null, bedTime: string, wakeTime: string, energy: number, thoughts: string}>} entries
 * @returns {string} CSV string with header row and one data row per entry
 */
export function exportJournalCSV(entries) {
  const header = ["Date", "Weight(lbs)", "Bedtime", "Wake", "Sleep", "Energy", "Mood", "Thoughts"];
  const rows = [header.join(",")];

  for (const entry of entries) {
    const sleep = calculateSleepDuration(entry.bedTime, entry.wakeTime) ?? "";
    const energyLabel = ENERGY_LEVELS[entry.energy]?.label ?? "";
    const weight = entry.weightLbs != null ? String(entry.weightLbs) : "";
    const mood = entry.mood != null ? String(entry.mood) : "";

    const row = [
      escapeCSVField(entry.date),
      escapeCSVField(weight),
      escapeCSVField(entry.bedTime ?? ""),
      escapeCSVField(entry.wakeTime ?? ""),
      escapeCSVField(sleep),
      escapeCSVField(energyLabel),
      escapeCSVField(mood),
      escapeCSVField(entry.thoughts),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Serializes an array of HealthDoc objects to a CSV string.
 * Columns: File Name, Category, Date, Size
 *
 * @param {Array<{id: string, name: string, category: string, date: string, size: string, url: string}>} docs
 * @returns {string} CSV string with header row and one data row per document
 */
export function exportDocumentsCSV(docs) {
  const header = ["File Name", "Category", "Date", "Size"];
  const rows = [header.join(",")];

  for (const doc of docs) {
    const row = [
      escapeCSVField(doc.name),
      escapeCSVField(doc.category),
      escapeCSVField(doc.date),
      escapeCSVField(doc.size),
    ];
    rows.push(row.join(","));
  }

  return rows.join("\n");
}

/**
 * Triggers a browser file download for the given CSV string.
 * Creates a Blob with type 'text/csv;charset=utf-8;', generates an object URL,
 * creates a temporary anchor element, clicks it, then revokes the URL.
 *
 * @param {string} csvString - The CSV content to download
 * @param {string} filename - The filename for the download (e.g., "health_journal_2026-04-21.csv")
 */
export function triggerDownload(csvString, filename) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

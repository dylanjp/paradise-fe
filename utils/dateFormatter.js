/**
 * Date formatting utilities for the Health Portal.
 * Formats ISO date strings and Date objects for display.
 */

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_FULL = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

const WEEKDAY_NAMES = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY",
  "THURSDAY", "FRIDAY", "SATURDAY",
];

/** Displayed when a date is missing or unparseable, so a bad record can't crash the page. */
const INVALID_DATE_PLACEHOLDER = "—";

/**
 * Parses an ISO date string (YYYY-MM-DD) into year, month, day parts.
 * Splits the string to avoid timezone offset issues that occur with new Date(dateStr).
 * Returns null for missing or malformed input so callers can render a placeholder
 * instead of throwing.
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {{ year: number, month: number, day: number } | null}
 */
function parseDateParts(dateStr) {
  if (typeof dateStr !== "string") return null;
  const segments = dateStr.split("-");
  if (segments.length !== 3) return null;
  const [year, month, day] = segments.map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Formats a date string as "Mon D, YYYY" (e.g., "Apr 21, 2026")
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date, or a placeholder if the input is missing/invalid
 */
export function formatShortDate(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return INVALID_DATE_PLACEHOLDER;
  const { year, month, day } = parts;
  const monthAbbr = MONTH_NAMES_SHORT[month - 1];
  return `${monthAbbr} ${day}, ${year}`;
}

/**
 * Formats a date string as "WEEKDAY, MONTH DAY, YEAR" (e.g., "THURSDAY, APRIL 23, 2026")
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {string} Formatted date all uppercase, or a placeholder if missing/invalid
 */
export function formatLongDate(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return INVALID_DATE_PLACEHOLDER;
  const { year, month, day } = parts;
  // Construct date from parts using UTC to avoid timezone shifts
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const monthName = MONTH_NAMES_FULL[month - 1];
  return `${weekday}, ${monthName} ${day}, ${year}`;
}

/**
 * Formats a date as MM/DD/YY for the StatusBar display
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
export function formatStatusDate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

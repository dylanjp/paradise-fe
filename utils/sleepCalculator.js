/**
 * Sleep duration computation utility for the Health Portal.
 * Calculates the forward time difference between bedTime and wakeTime,
 * handling midnight crossing.
 */

/**
 * Parses a time string in "HH:MM" 24-hour format into total minutes since midnight.
 * @param {string} timeStr - Time string (HH:MM, 24h format)
 * @returns {number} Total minutes since midnight (0–1439)
 */
function parseTimeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculates the forward sleep duration from bedTime to wakeTime.
 * Handles midnight crossing (e.g., bedTime "23:00", wakeTime "07:00" → 8h 0m).
 * If bedTime equals wakeTime, returns "0h 0m".
 * If either input is missing/empty, returns null.
 *
 * @param {string} bedTime - Bed time in "HH:MM" 24-hour format
 * @param {string} wakeTime - Wake time in "HH:MM" 24-hour format
 * @returns {string|null} Formatted duration string (e.g., "7h 30m"), or null when inputs are incomplete.
 */
export function calculateSleepDuration(bedTime, wakeTime) {
  if (!bedTime || !wakeTime) return null;
  const bedMinutes = parseTimeToMinutes(bedTime);
  const wakeMinutes = parseTimeToMinutes(wakeTime);

  let diffMinutes;
  if (wakeMinutes >= bedMinutes) {
    diffMinutes = wakeMinutes - bedMinutes;
  } else {
    // Midnight crossing: wake is next day
    diffMinutes = (24 * 60 - bedMinutes) + wakeMinutes;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * Returns sleep duration as decimal hours (e.g., 7.5 for 7h 30m), or null when
 * inputs are incomplete. Useful for charting and averaging.
 *
 * @param {string} bedTime - Bed time in "HH:MM" 24-hour format
 * @param {string} wakeTime - Wake time in "HH:MM" 24-hour format
 * @returns {number|null}
 */
export function calculateSleepHours(bedTime, wakeTime) {
  if (!bedTime || !wakeTime) return null;
  const bedMinutes = parseTimeToMinutes(bedTime);
  const wakeMinutes = parseTimeToMinutes(wakeTime);
  const diff = wakeMinutes >= bedMinutes
    ? wakeMinutes - bedMinutes
    : (24 * 60 - bedMinutes) + wakeMinutes;
  return diff / 60;
}

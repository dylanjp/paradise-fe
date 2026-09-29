/**
 * HSA Receipt Naming Utility
 * Pure helpers that turn a dollar amount plus a receipt date into the canonical
 * filename `{amount}_{YYYY}_{MON}_{DD}.{ext}` (e.g. "1000_2026_AUG_16.pdf"),
 * along with collision-free name selection for repeat receipts.
 *
 * No React, no DOM, no network — everything here is unit-testable in isolation.
 */

import { MONTH_NAMES_SHORT } from "./dateConstants";

/** Sanity ceiling for a single receipt; guards against fat-fingered input. */
export const MAX_RECEIPT_AMOUNT = 1000000;

/** Whole dollars only — cents are rejected rather than silently rounded. */
const AMOUNT_PATTERN = /^\d+$/;

/**
 * Normalizes user input into a whole-dollar amount.
 * Strips "$", thousands separators, whitespace, and a leading "+".
 *
 * @param {string|number} input - Raw value from the amount field
 * @returns {{ valid: boolean, value?: number, error?: string }}
 */
export function parseAmount(input) {
  if (input === null || input === undefined) {
    return { valid: false, error: "Amount is required" };
  }

  const raw = String(input).trim();
  if (raw === "") {
    return { valid: false, error: "Amount is required" };
  }

  const stripped = raw.replace(/^\+/, "").replace(/[$,\s]/g, "");

  if (!AMOUNT_PATTERN.test(stripped)) {
    return {
      valid: false,
      error: "Whole dollars only — round to the nearest dollar",
    };
  }

  const value = Number(stripped);
  if (!Number.isFinite(value) || value <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }
  if (value > MAX_RECEIPT_AMOUNT) {
    return {
      valid: false,
      error: `Amount must be ${MAX_RECEIPT_AMOUNT.toLocaleString()} or less`,
    };
  }

  return { valid: true, value };
}

/**
 * Validates an ISO date string (YYYY-MM-DD) from a native date input.
 * Rejects impossible calendar dates (e.g. Feb 30) by round-tripping through Date,
 * and implausible years, which is what a mistyped date input usually produces.
 *
 * @param {string} input - ISO date string
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function parseReceiptDate(input) {
  if (typeof input !== "string" || input.trim() === "") {
    return { valid: false, error: "Receipt date is required" };
  }

  const segments = input.trim().split("-");
  if (segments.length !== 3) {
    return { valid: false, error: "Enter a valid date" };
  }

  const [year, month, day] = segments.map(Number);
  if (![year, month, day].every(Number.isInteger)) {
    return { valid: false, error: "Enter a valid date" };
  }
  if (year < 1900 || year > 2999) {
    return { valid: false, error: "Enter a year between 1900 and 2999" };
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: "Enter a valid date" };
  }

  // Catches Feb 30 and friends: Date rolls them forward into the next month.
  const probe = new Date(year, month - 1, day);
  if (
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return { valid: false, error: "Enter a valid date" };
  }

  return { valid: true, value: input.trim() };
}

/**
 * Formats a validated ISO date as the `{YYYY}_{MON}_{DD}` filename segment.
 * Days are zero-padded so receipt names sort lexicographically in the drive.
 *
 * @param {string} isoDate - ISO date string (YYYY-MM-DD)
 * @returns {string|null} e.g. "2026_AUG_16", or null if the input is invalid
 */
export function formatReceiptDate(isoDate) {
  const parsed = parseReceiptDate(isoDate);
  if (!parsed.valid) return null;

  const [year, month, day] = parsed.value.split("-").map(Number);
  const monthAbbr = MONTH_NAMES_SHORT[month - 1].toUpperCase();
  return `${year}_${monthAbbr}_${String(day).padStart(2, "0")}`;
}

/**
 * Today as an ISO date string using the *local* calendar date.
 * Deliberately not derived from toISOString(), which is UTC and would show
 * yesterday for an evening visitor west of UTC.
 *
 * @returns {string} e.g. "2026-08-16"
 */
export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Splits a filename into its base and lowercase extension.
 * "scan.final.PDF" -> { base: "scan.final", ext: "pdf" }
 * "receipt"        -> { base: "receipt",    ext: "" }
 * ".gitignore"     -> { base: ".gitignore", ext: "" }  (a leading dot is not an extension)
 * "trailing."      -> { base: "trailing.",  ext: "" }
 *
 * @param {string} fileName
 * @returns {{ base: string, ext: string }}
 */
export function splitExtension(fileName) {
  const name = typeof fileName === "string" ? fileName : "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return { base: name, ext: "" };
  }
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/**
 * Builds the stem/extension pair for a receipt. Kept as parts rather than a
 * joined string so a collision suffix can be inserted before the extension
 * without re-parsing a finished name.
 *
 * @param {number} amount - Validated whole-dollar amount (see parseAmount)
 * @param {string} originalFileName - The user's file name, for its extension
 * @param {string} isoDate - Validated ISO date string (see parseReceiptDate)
 * @returns {{ stem: string, ext: string }}
 * @throws {Error} if the date is not a valid ISO date
 */
export function buildReceiptNameParts(amount, originalFileName, isoDate) {
  const datePart = formatReceiptDate(isoDate);
  if (datePart === null) {
    throw new Error(`Invalid receipt date: ${isoDate}`);
  }
  return {
    stem: `${amount}_${datePart}`,
    ext: splitExtension(originalFileName).ext,
  };
}

/**
 * Joins name parts, appending "_N" before the extension for N > 1.
 *
 * @param {{ stem: string, ext: string }} parts
 * @param {number} [sequence=1]
 * @returns {string}
 */
export function joinNameParts({ stem, ext }, sequence = 1) {
  const suffixed = sequence > 1 ? `${stem}_${sequence}` : stem;
  return ext ? `${suffixed}.${ext}` : suffixed;
}

/**
 * Builds the canonical receipt filename.
 * buildReceiptFileName(1000, "scan.pdf", "2026-08-16") === "1000_2026_AUG_16.pdf"
 *
 * @param {number} amount
 * @param {string} originalFileName
 * @param {string} isoDate
 * @returns {string}
 */
export function buildReceiptFileName(amount, originalFileName, isoDate) {
  return joinNameParts(
    buildReceiptNameParts(amount, originalFileName, isoDate),
  );
}

/**
 * Returns the first name in the `stem`, `stem_2`, `stem_3`… series that is not
 * already taken. Comparison is case-insensitive because the drive is backed by a
 * filesystem that may itself be case-insensitive.
 *
 * @param {{ stem: string, ext: string }} parts
 * @param {string[]} existingNames - Sibling names already in the folder
 * @param {number} [maxAttempts=50]
 * @returns {string}
 * @throws {Error} if every candidate up to maxAttempts is taken
 */
export function nextAvailableFileName(parts, existingNames, maxAttempts = 50) {
  const taken = new Set(
    (existingNames || []).map((name) => String(name).toLowerCase()),
  );

  for (let n = 1; n <= maxAttempts; n++) {
    const candidate = joinNameParts(parts, n);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }

  throw new Error(
    `Could not find a free name for "${joinNameParts(parts)}" after ${maxAttempts} attempts`,
  );
}

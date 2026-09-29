/**
 * Unit and property tests for the HSA receipt naming rules.
 *
 * The generated filename is a data contract — it is the only place the amount
 * and date of a receipt are recorded — so its shape is pinned here rather than
 * left to the UI.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  MAX_RECEIPT_AMOUNT,
  parseAmount,
  parseReceiptDate,
  formatReceiptDate,
  todayIso,
  splitExtension,
  buildReceiptNameParts,
  joinNameParts,
  buildReceiptFileName,
  nextAvailableFileName,
} from "../hsaReceipt";

describe("parseAmount", () => {
  it("accepts a plain whole-dollar amount", () => {
    expect(parseAmount("1000")).toEqual({ valid: true, value: 1000 });
  });

  it("strips currency symbols, separators and whitespace", () => {
    expect(parseAmount("$1,000")).toEqual({ valid: true, value: 1000 });
    expect(parseAmount("  $1,000  ")).toEqual({ valid: true, value: 1000 });
    expect(parseAmount("+250")).toEqual({ valid: true, value: 250 });
  });

  it("requires a value", () => {
    for (const input of ["", "   ", null, undefined]) {
      expect(parseAmount(input)).toEqual({
        valid: false,
        error: "Amount is required",
      });
    }
  });

  it("rejects cents with a message telling the user to round", () => {
    const result = parseAmount("1000.50");
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      "Whole dollars only — round to the nearest dollar",
    );
  });

  it("rejects non-numeric and exponent input", () => {
    for (const input of ["abc", "1e3", "1.2.3", "--5", "12a"]) {
      expect(parseAmount(input).valid).toBe(false);
    }
  });

  it("rejects zero and negative amounts", () => {
    expect(parseAmount("0")).toEqual({
      valid: false,
      error: "Amount must be greater than 0",
    });
    // "-50" fails the digits-only pattern before the sign is ever evaluated.
    expect(parseAmount("-50").valid).toBe(false);
  });

  it("rejects amounts above the ceiling", () => {
    expect(parseAmount(String(MAX_RECEIPT_AMOUNT)).valid).toBe(true);
    const over = parseAmount(String(MAX_RECEIPT_AMOUNT + 1));
    expect(over.valid).toBe(false);
    expect(over.error).toBe("Amount must be 1,000,000 or less");
  });
});

describe("parseReceiptDate", () => {
  it("accepts a well-formed ISO date", () => {
    expect(parseReceiptDate("2026-08-16")).toEqual({
      valid: true,
      value: "2026-08-16",
    });
  });

  it("requires a value", () => {
    for (const input of ["", "   ", null, undefined, 20260816]) {
      expect(parseReceiptDate(input)).toEqual({
        valid: false,
        error: "Receipt date is required",
      });
    }
  });

  it("rejects malformed input", () => {
    for (const input of ["2026/08/16", "2026-08", "not-a-date", "2026-13-01"]) {
      expect(parseReceiptDate(input).valid).toBe(false);
    }
  });

  it("rejects impossible calendar dates", () => {
    expect(parseReceiptDate("2026-02-30").valid).toBe(false);
    expect(parseReceiptDate("2026-04-31").valid).toBe(false);
    // 2028 is a leap year, so Feb 29 is real there but not in 2026.
    expect(parseReceiptDate("2026-02-29").valid).toBe(false);
    expect(parseReceiptDate("2028-02-29").valid).toBe(true);
  });

  it("rejects implausible years from a mistyped date field", () => {
    const result = parseReceiptDate("0026-08-16");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Enter a year between 1900 and 2999");
  });
});

describe("formatReceiptDate", () => {
  it("formats the month as a 3-letter uppercase abbreviation", () => {
    expect(formatReceiptDate("2026-08-16")).toBe("2026_AUG_16");
    expect(formatReceiptDate("2026-12-31")).toBe("2026_DEC_31");
  });

  it("zero-pads single-digit days so names sort lexicographically", () => {
    expect(formatReceiptDate("2026-01-05")).toBe("2026_JAN_05");
  });

  it("returns null for invalid input", () => {
    expect(formatReceiptDate("nonsense")).toBeNull();
    expect(formatReceiptDate("")).toBeNull();
  });
});

describe("todayIso", () => {
  it("returns a zero-padded local ISO date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the local calendar date, not the UTC one", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(todayIso()).toBe(expected);
  });
});

describe("splitExtension", () => {
  it("splits on the last dot and lowercases the extension", () => {
    expect(splitExtension("receipt.pdf")).toEqual({
      base: "receipt",
      ext: "pdf",
    });
    expect(splitExtension("scan.final.PDF")).toEqual({
      base: "scan.final",
      ext: "pdf",
    });
  });

  it("treats a missing, leading, or trailing dot as no extension", () => {
    expect(splitExtension("receipt")).toEqual({ base: "receipt", ext: "" });
    expect(splitExtension(".gitignore")).toEqual({
      base: ".gitignore",
      ext: "",
    });
    expect(splitExtension("trailing.")).toEqual({
      base: "trailing.",
      ext: "",
    });
  });
});

describe("buildReceiptFileName", () => {
  it("produces the documented example", () => {
    expect(buildReceiptFileName(1000, "receipt.pdf", "2026-08-16")).toBe(
      "1000_2026_AUG_16.pdf",
    );
  });

  it("preserves the original extension, lowercased", () => {
    expect(buildReceiptFileName(250, "SCAN.JPEG", "2026-01-05")).toBe(
      "250_2026_JAN_05.jpeg",
    );
  });

  it("omits the dot entirely when the source has no extension", () => {
    expect(buildReceiptFileName(1000, "receipt", "2026-08-16")).toBe(
      "1000_2026_AUG_16",
    );
  });

  it("throws on an invalid date rather than emitting a malformed name", () => {
    expect(() => buildReceiptFileName(1000, "a.pdf", "nope")).toThrow(
      /Invalid receipt date/,
    );
  });
});

describe("nextAvailableFileName", () => {
  const parts = { stem: "1000_2026_AUG_16", ext: "pdf" };

  it("returns the base name when nothing is taken", () => {
    expect(nextAvailableFileName(parts, [])).toBe("1000_2026_AUG_16.pdf");
    expect(nextAvailableFileName(parts, null)).toBe("1000_2026_AUG_16.pdf");
  });

  it("suffixes with _2 when the base name is taken", () => {
    expect(nextAvailableFileName(parts, ["1000_2026_AUG_16.pdf"])).toBe(
      "1000_2026_AUG_16_2.pdf",
    );
  });

  it("keeps counting past taken suffixes", () => {
    expect(
      nextAvailableFileName(parts, [
        "1000_2026_AUG_16.pdf",
        "1000_2026_AUG_16_2.pdf",
      ]),
    ).toBe("1000_2026_AUG_16_3.pdf");
  });

  it("compares case-insensitively, since the drive is filesystem-backed", () => {
    expect(nextAvailableFileName(parts, ["1000_2026_AUG_16.PDF"])).toBe(
      "1000_2026_AUG_16_2.pdf",
    );
  });

  it("inserts the suffix before the extension, not at the end", () => {
    const taken = nextAvailableFileName(parts, ["1000_2026_AUG_16.pdf"]);
    expect(taken.endsWith(".pdf")).toBe(true);
  });

  it("suffixes extension-less names without inventing a dot", () => {
    const bare = { stem: "1000_2026_AUG_16", ext: "" };
    expect(nextAvailableFileName(bare, ["1000_2026_AUG_16"])).toBe(
      "1000_2026_AUG_16_2",
    );
  });

  it("throws once every candidate up to maxAttempts is taken", () => {
    const taken = [
      joinNameParts(parts, 1),
      joinNameParts(parts, 2),
      joinNameParts(parts, 3),
    ];
    expect(() => nextAvailableFileName(parts, taken, 3)).toThrow(
      /Could not find a free name/,
    );
  });
});

describe("properties", () => {
  const NAME_PATTERN =
    /^\d+_\d{4}_(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)_\d{2}(?:\.[a-z0-9]+)?$/;

  it("every generated filename matches the parseable receipt pattern", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_RECEIPT_AMOUNT }),
        fc.date({
          min: new Date(1900, 0, 1),
          max: new Date(2999, 11, 31),
          noInvalidDate: true,
        }),
        fc.constantFrom("pdf", "png", "jpg", "PDF", "jpeg"),
        (amount, date, ext) => {
          const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
          const name = buildReceiptFileName(amount, `receipt.${ext}`, iso);
          expect(name).toMatch(NAME_PATTERN);
        },
      ),
    );
  });

  it("nextAvailableFileName never returns a name already taken", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_RECEIPT_AMOUNT }),
        fc.array(fc.string(), { maxLength: 30 }),
        fc.integer({ min: 0, max: 6 }),
        (amount, noise, collisions) => {
          const parts = buildReceiptNameParts(
            amount,
            "receipt.pdf",
            "2026-08-16",
          );
          const existing = [
            ...noise,
            ...Array.from({ length: collisions }, (_, i) =>
              joinNameParts(parts, i + 1),
            ),
          ];
          const chosen = nextAvailableFileName(parts, existing);
          const takenLower = existing.map((n) => n.toLowerCase());
          expect(takenLower).not.toContain(chosen.toLowerCase());
        },
      ),
    );
  });

  it("splitExtension loses no characters", () => {
    fc.assert(
      fc.property(fc.string(), (name) => {
        const { base, ext } = splitExtension(name);
        expect(base.length + (ext ? ext.length + 1 : 0)).toBe(name.length);
      }),
    );
  });
});

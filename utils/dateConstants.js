/**
 * Shared date constants and formatting utilities.
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const DAY_NAMES_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/**
 * Gets ordinal suffix for a day number (1st, 2nd, 3rd, etc.)
 * @param {number} day - Day of month (1-31)
 * @returns {string} Ordinal suffix (st, nd, rd, th)
 */
export function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Formats a recurrence rule to a human-readable summary.
 * @param {object} rule - Recurrence rule object
 * @param {object} [options]
 * @param {boolean} [options.compact=false] - Use compact format for admin views
 * @returns {string}
 */
export function formatRecurrence(rule, { compact = false } = {}) {
  if (!rule) return compact ? "-" : "";

  // Support both 'frequency' and 'type' field names for compatibility
  const ruleType = rule.frequency || rule.type;

  switch (ruleType) {
    case "DAILY":
      return "Daily";
    case "WEEKLY":
      if (rule.dayOfWeek !== undefined) {
        const dayName = DAY_NAMES_SHORT[rule.dayOfWeek];
        return compact ? `Weekly (${dayName})` : `Weekly on ${dayName}`;
      }
      return "Weekly";
    case "MONTHLY":
      if (rule.dayOfMonth !== undefined) {
        if (compact) return `Monthly (${rule.dayOfMonth})`;
        const suffix = getOrdinalSuffix(rule.dayOfMonth);
        return `Monthly on ${rule.dayOfMonth}${suffix}`;
      }
      return "Monthly";
    case "YEARLY": {
      const monthName = compact
        ? MONTH_NAMES_SHORT[rule.month - 1]
        : MONTH_NAMES[rule.month - 1];
      if (compact) return `Yearly (${monthName} ${rule.dayOfMonth})`;
      const suffix = getOrdinalSuffix(rule.dayOfMonth);
      return `Yearly on ${monthName} ${rule.dayOfMonth}${suffix}`;
    }
    case "RANDOM_DATE_RANGE": {
      const startMonth = MONTH_NAMES_SHORT[rule.startMonth - 1];
      const endMonth = MONTH_NAMES_SHORT[rule.endMonth - 1];
      if (compact)
        return `Random (${startMonth} ${rule.startDay}-${endMonth} ${rule.endDay})`;
      return `Random: ${startMonth} ${rule.startDay} - ${endMonth} ${rule.endDay}`;
    }
    default:
      return "Recurring";
  }
}

/**
 * Recurrence Validation Utility
 * Provides validation and formatting functions for YEARLY and RANDOM_DATE_RANGE recurrence types.
 */

/**
 * Days per month lookup (February uses 29 for leap year support)
 */
const DAYS_IN_MONTH = {
  1: 31,
  2: 29,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31
};

/**
 * Month names for display
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Gets the maximum day for a given month
 * @param {number} month - Month value (1-12)
 * @returns {number} Maximum day for the month
 */
function getMaxDayForMonth(month) {
  return DAYS_IN_MONTH[month] || 31;
}

/**
 * Gets ordinal suffix for a day number
 * @param {number} day - Day of month (1-31)
 * @returns {string} Ordinal suffix (st, nd, rd, th)
 */
function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) {
    return 'th';
  }
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

/**
 * Validates a month value
 * @param {number|undefined} month - Month value (1-12)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateMonth(month) {
  if (month === undefined || month === null || month === '') {
    return { valid: false, error: 'Month is required' };
  }
  
  const monthNum = Number(month);
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
    return { valid: false, error: 'Month must be between 1 and 12' };
  }
  
  return { valid: true };
}

/**
 * Validates a day value for a given month
 * @param {number|undefined} day - Day value (1-31)
 * @param {number} month - Month value (1-12)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateDayForMonth(day, month) {
  if (day === undefined || day === null || day === '') {
    return { valid: false, error: 'Day is required' };
  }
  
  const dayNum = Number(day);
  if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
    return { valid: false, error: 'Day must be between 1 and 31' };
  }
  
  const maxDay = getMaxDayForMonth(month);
  if (dayNum > maxDay) {
    const monthName = MONTH_NAMES[month - 1] || `month ${month}`;
    return { valid: false, error: `Day ${dayNum} does not exist in ${monthName}` };
  }
  
  return { valid: true };
}

/**
 * Validates a YEARLY recurrence rule
 * @param {{ month?: number, dayOfMonth?: number }} rule
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validateYearlyRecurrence(rule) {
  const errors = {};
  
  // Validate month
  if (rule.month === undefined || rule.month === null || rule.month === '') {
    errors.month = 'Month is required for yearly recurrence';
  } else {
    const monthResult = validateMonth(rule.month);
    if (!monthResult.valid) {
      errors.month = monthResult.error;
    }
  }
  
  // Validate day
  if (rule.dayOfMonth === undefined || rule.dayOfMonth === null || rule.dayOfMonth === '') {
    errors.dayOfMonth = 'Day of month is required for yearly recurrence';
  } else {
    const dayNum = Number(rule.dayOfMonth);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      errors.dayOfMonth = 'Day of month must be between 1 and 31';
    } else if (!errors.month && rule.month) {
      // Only validate day against month if month is valid
      const maxDay = getMaxDayForMonth(Number(rule.month));
      if (dayNum > maxDay) {
        const monthName = MONTH_NAMES[Number(rule.month) - 1];
        errors.dayOfMonth = `Day ${dayNum} does not exist in ${monthName}`;
      }
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates a RANDOM_DATE_RANGE recurrence rule
 * Supports cross-year ranges (e.g., November to January)
 * @param {{ startMonth?: number, startDay?: number, endMonth?: number, endDay?: number }} rule
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validateRandomDateRangeRecurrence(rule) {
  const errors = {};
  
  // Validate start month
  if (rule.startMonth === undefined || rule.startMonth === null || rule.startMonth === '') {
    errors.startMonth = 'Start month is required for date range recurrence';
  } else {
    const monthResult = validateMonth(rule.startMonth);
    if (!monthResult.valid) {
      errors.startMonth = 'Month must be between 1 and 12';
    }
  }
  
  // Validate start day
  if (rule.startDay === undefined || rule.startDay === null || rule.startDay === '') {
    errors.startDay = 'Start day is required for date range recurrence';
  } else {
    const dayNum = Number(rule.startDay);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      errors.startDay = 'Day must be between 1 and 31';
    } else if (!errors.startMonth && rule.startMonth) {
      const maxDay = getMaxDayForMonth(Number(rule.startMonth));
      if (dayNum > maxDay) {
        const monthName = MONTH_NAMES[Number(rule.startMonth) - 1];
        errors.startDay = `Day ${dayNum} does not exist in ${monthName}`;
      }
    }
  }
  
  // Validate end month
  if (rule.endMonth === undefined || rule.endMonth === null || rule.endMonth === '') {
    errors.endMonth = 'End month is required for date range recurrence';
  } else {
    const monthResult = validateMonth(rule.endMonth);
    if (!monthResult.valid) {
      errors.endMonth = 'Month must be between 1 and 12';
    }
  }
  
  // Validate end day
  if (rule.endDay === undefined || rule.endDay === null || rule.endDay === '') {
    errors.endDay = 'End day is required for date range recurrence';
  } else {
    const dayNum = Number(rule.endDay);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 31) {
      errors.endDay = 'Day must be between 1 and 31';
    } else if (!errors.endMonth && rule.endMonth) {
      const maxDay = getMaxDayForMonth(Number(rule.endMonth));
      if (dayNum > maxDay) {
        const monthName = MONTH_NAMES[Number(rule.endMonth) - 1];
        errors.endDay = `Day ${dayNum} does not exist in ${monthName}`;
      }
    }
  }
  
  // Note: Cross-year ranges (startMonth > endMonth) are valid per requirement 3.4
  // No additional validation needed for range order
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Formats a recurrence rule for display preview
 * @param {object} rule - Recurrence rule object with type property
 * @returns {string} Human-readable recurrence description
 */
function formatRecurrencePreview(rule) {
  if (!rule || !rule.type) {
    return '';
  }
  
  switch (rule.type) {
    case 'YEARLY': {
      const month = Number(rule.month);
      const day = Number(rule.dayOfMonth);
      if (!month || !day || month < 1 || month > 12) {
        return '';
      }
      const monthName = MONTH_NAMES[month - 1];
      const suffix = getOrdinalSuffix(day);
      return `Recurs every year on ${monthName} ${day}${suffix}`;
    }
    
    case 'RANDOM_DATE_RANGE': {
      const startMonth = Number(rule.startMonth);
      const startDay = Number(rule.startDay);
      const endMonth = Number(rule.endMonth);
      const endDay = Number(rule.endDay);
      
      if (!startMonth || !startDay || !endMonth || !endDay) {
        return '';
      }
      if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
        return '';
      }
      
      const startMonthName = MONTH_NAMES[startMonth - 1];
      const endMonthName = MONTH_NAMES[endMonth - 1];
      const startSuffix = getOrdinalSuffix(startDay);
      const endSuffix = getOrdinalSuffix(endDay);
      
      return `Recurs on a random date between ${startMonthName} ${startDay}${startSuffix} and ${endMonthName} ${endDay}${endSuffix} each year`;
    }
    
    default:
      return '';
  }
}

export {
  DAYS_IN_MONTH,
  MONTH_NAMES,
  getMaxDayForMonth,
  getOrdinalSuffix,
  validateMonth,
  validateDayForMonth,
  validateYearlyRecurrence,
  validateRandomDateRangeRecurrence,
  formatRecurrencePreview
};

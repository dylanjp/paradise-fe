/**
 * Chart Utility Functions
 * Helper functions for processing data for the ContributionChart component
 * 
 * Requirements: 5.1, 5.2, 4.2, 4.3
 */

/**
 * Generate all days for a given year
 * @param {number} year - The year to generate days for
 * @returns {Array<{date: string, dayOfWeek: number}>} Array of day objects
 */
export function generateYearDays(year) {
  const days = [];
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    days.push({
      date: d.toISOString().split('T')[0],
      dayOfWeek: d.getDay()
    });
  }
  
  return days;
}

/**
 * Group days into weeks for grid layout
 * Each week is a column with 7 rows (one per day of the week)
 * @param {Array<{date: string, dayOfWeek: number}>} days - Array of day objects
 * @returns {Array<Array>} Array of week arrays
 */
export function groupByWeek(days) {
  const weeks = [];
  let currentWeek = [];
  
  // Pad first week with empty slots if year doesn't start on Sunday
  const firstDayOfWeek = days[0].dayOfWeek;
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }
  
  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  
  // Add remaining days as final week
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }
  
  return weeks;
}

/**
 * Extract unique years from completion dates
 * @param {string[]} dates - Array of ISO date strings (YYYY-MM-DD)
 * @returns {number[]} Sorted array of years (descending)
 */
export function extractYears(dates) {
  if (!dates || dates.length === 0) {
    return [];
  }
  
  const years = new Set(dates.map(d => new Date(d).getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Generate month labels with their positions for the chart header
 * @param {number} year - The year to generate labels for
 * @returns {Array<{month: string, weekIndex: number}>} Array of month label objects
 */
export function generateMonthLabels(year) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = [];
  
  for (let month = 0; month < 12; month++) {
    // Get the first day of each month
    const firstDayOfMonth = new Date(year, month, 1);
    
    // Calculate which week this falls into
    const startOfYear = new Date(year, 0, 1);
    const dayOfYear = Math.floor((firstDayOfMonth - startOfYear) / (24 * 60 * 60 * 1000));
    const startDayOffset = startOfYear.getDay(); // Day of week for Jan 1
    const weekIndex = Math.floor((dayOfYear + startDayOffset) / 7);
    
    labels.push({
      month: monthNames[month],
      weekIndex: weekIndex
    });
  }
  
  return labels;
}

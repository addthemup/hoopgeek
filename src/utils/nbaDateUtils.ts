/**
 * NBA Date/Time Utilities
 * 
 * Converts UTC times from nba_games to EST/EDT (America/New_York timezone)
 * This ensures games are displayed on the correct date in the app
 */

/**
 * Convert a UTC date string or Date object to EST/EDT date string (YYYY-MM-DD)
 * This is the primary function for determining which date a game should appear on
 * 
 * @param utcDate - UTC date string (ISO format) or Date object
 * @returns EST/EDT date string in YYYY-MM-DD format
 * 
 * @example
 * utcToESTDate('2025-12-07T00:30:00Z') // Returns '2025-12-06' (if EST is UTC-5)
 * utcToESTDate('2025-12-07T04:00:00Z') // Returns '2025-12-07'
 */
export function utcToESTDate(utcDate: string | Date): string {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  // Use Intl.DateTimeFormat to get date parts in EST/EDT timezone
  // This correctly handles the timezone conversion
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  
  return `${year}-${month}-${day}`;
}

/**
 * Convert a UTC date string or Date object to EST/EDT Date object
 * Note: This returns a Date object with the EST/EDT time values, but the Date object
 * itself is still in the local timezone. Use formatESTTime for display.
 * 
 * @param utcDate - UTC date string (ISO format) or Date object
 * @returns Date object with EST/EDT time values (for formatting purposes)
 */
export function utcToESTDateTime(utcDate: string | Date): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  
  // Get EST/EDT time components
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0') - 1; // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0');
  
  // Create a Date object with these EST values (will be interpreted as local time)
  return new Date(year, month, day, hour, minute, second);
}

/**
 * Get today's date in EST/EDT timezone (YYYY-MM-DD)
 * This correctly converts the current UTC time to EST/EDT date
 * 
 * @returns EST/EDT date string in YYYY-MM-DD format
 */
export function getTodayEST(): string {
  // Get current UTC time and convert to EST/EDT date
  const now = new Date();
  return utcToESTDate(now);
}

/**
 * Parse YYYY-MM-DD into numeric parts.
 */
function parseYMD(ymd: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Add calendar days to a YYYY-MM-DD string.
 */
export function addDaysToESTDate(ymd: string, days: number): string {
  const parsed = parseYMD(ymd);
  if (!parsed || !Number.isFinite(days) || days === 0) return ymd;
  const dt = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Site day in ET with a configurable rollover hour.
 * Example: rollover=3 means 12:00 AM - 2:59 AM ET still counts as previous day.
 */
export function getSiteDayEST(rolloverHour = 3): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '0');
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  if (!year || !month || !day) return utcToESTDate(now);
  const dateYMD = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (hour < rolloverHour) return addDaysToESTDate(dateYMD, -1);
  return dateYMD;
}

/**
 * Guard and normalize a candidate date string.
 */
export function normalizeESTDateString(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * Format a UTC date string to EST/EDT time for display
 * 
 * @param utcDate - UTC date string (ISO format) or Date object
 * @param format - Format string (default: 'h:mm A' for time, or 'M/D' for date)
 * @returns Formatted date string
 * 
 * @example
 * formatESTTime('2025-12-07T19:00:00Z') // Returns '2:00 PM'
 * formatESTDate('2025-12-07T19:00:00Z') // Returns '12/7'
 */
export function formatESTTime(utcDate: string | Date, format: 'time' | 'date' | 'datetime' = 'time'): string {
  const estDate = utcToESTDateTime(utcDate);
  
  if (format === 'time') {
    // Format as time: "h:mm A" (e.g., "7:00 PM")
    const hours = estDate.getHours();
    const minutes = estDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
  } else if (format === 'date') {
    // Format as date: "M/D" (e.g., "12/7")
    return `${estDate.getMonth() + 1}/${estDate.getDate()}`;
  } else {
    // Format as datetime: "M/D h:mm A" (e.g., "12/7 7:00 PM")
    const dateStr = `${estDate.getMonth() + 1}/${estDate.getDate()}`;
    const hours = estDate.getHours();
    const minutes = estDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeStr = `${displayHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
    return `${dateStr} ${timeStr}`;
  }
}

/**
 * Format a UTC date string to EST/EDT date for display (alias for formatESTTime with 'date')
 * 
 * @param utcDate - UTC date string (ISO format) or Date object
 * @returns Formatted date string (e.g., "12/7")
 */
export function formatESTDate(utcDate: string | Date): string {
  return formatESTTime(utcDate, 'date');
}

/**
 * Check if a UTC date string falls on a specific EST/EDT date
 * 
 * @param utcDate - UTC date string (ISO format) or Date object
 * @param estDateString - EST/EDT date string in YYYY-MM-DD format
 * @returns true if the UTC date falls on the specified EST date
 */
export function isDateInEST(utcDate: string | Date, estDateString: string): boolean {
  const estDate = utcToESTDate(utcDate);
  return estDate === estDateString;
}

/**
 * Get the EST/EDT date range for a UTC date range
 * Useful for querying games that might span multiple EST dates
 * 
 * @param startUTC - Start UTC date string
 * @param endUTC - End UTC date string
 * @returns Object with start and end EST dates
 */
export function getESTDateRange(startUTC: string | Date, endUTC: string | Date): { start: string; end: string } {
  return {
    start: utcToESTDate(startUTC),
    end: utcToESTDate(endUTC),
  };
}

/**
 * Filter games by EST/EDT date
 * 
 * @param games - Array of game objects with game_date property
 * @param estDateString - EST/EDT date string in YYYY-MM-DD format
 * @returns Filtered array of games that fall on the specified EST date
 */
export function filterGamesByESTDate<T extends { game_date: string | Date }>(
  games: T[],
  estDateString: string
): T[] {
  return games.filter(game => isDateInEST(game.game_date, estDateString));
}


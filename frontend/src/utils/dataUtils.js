/**
 * Timezone-safe date utilities for AssetOps
 *
 * ROOT CAUSE: new Date('2026-03-29') parses as 2026-03-29T00:00:00Z (UTC midnight).
 * In India (UTC+5:30) that becomes 2026-03-28T18:30:00 IST → displays as March 28 ❌
 *
 * RULE: Never pass a date-only string (YYYY-MM-DD) to new Date() for DISPLAY.
 *       Use these helpers instead — they work purely on the string, no timezone shifts.
 */

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG  = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];

/**
 * Extract just YYYY-MM-DD from any date string coming from the API.
 * Handles: 
 *   "2026-03-29T00:00:00.000Z" → "2026-03-29"
 *   "2026-03-29"               → "2026-03-29"
 *   "2026-03-29 00:00:00"      → "2026-03-29" (MySQL format)
 *   "2026-03-29T18:30:00+05:30" → "2026-03-29"
 *   null / undefined           → ""
 */
export const toDateStr = (val) => {
  if (!val) return '';
  const str = String(val);
  // Extract the first YYYY-MM-DD pattern found (handles any format)
  const match = str.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
};

/**
 * Format YYYY-MM-DD → "29 Mar 2026"  (no timezone conversion)
 */
export const fmtDate = (val) => {
  const s = toDateStr(val);
  if (!s || s.length < 10) return s || '—';
  const [y, m, d] = s.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
};

/**
 * Format YYYY-MM-DD → "29 March 2026"
 */
export const fmtDateLong = (val) => {
  const s = toDateStr(val);
  if (!s || s.length < 10) return s || '—';
  const [y, m, d] = s.split('-');
  return `${Number(d)} ${MONTHS_LONG[Number(m) - 1]} ${y}`;
};

/**
 * Format YYYY-MM-DD → "29/03/2026"
 */
export const fmtDateIN = (val) => {
  const s = toDateStr(val);
  if (!s || s.length < 10) return s || '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

/**
 * Is the YYYY-MM-DD string in the past? (timezone-safe comparison)
 * Compares date strings lexicographically — works perfectly for YYYY-MM-DD format.
 */
export const isExpired = (val) => {
  const s = toDateStr(val);
  if (!s) return false;
  const today = todayStr();
  return s < today;
};

/**
 * Is the YYYY-MM-DD string within the next N days?
 */
export const isExpiringSoon = (val, days = 90) => {
  const s = toDateStr(val);
  if (!s) return false;
  const today = todayStr();
  const future = addDays(today, days);
  return s >= today && s <= future;
};

/**
 * Get today's date as YYYY-MM-DD string — NO timezone issues.
 */
export const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Add N days to a YYYY-MM-DD string, return new YYYY-MM-DD string.
 */
export const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T12:00:00'); // noon — safe from DST
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Format a timestamp (ISO with time) for display — shows date + time.
 * "2026-03-29T06:30:00.000Z" → "29 Mar 2026, 12:00" (local time, safe)
 */
export const fmtTimestamp = (val) => {
  if (!val) return '—';
  const d = new Date(val); // timestamps with time component are fine
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};
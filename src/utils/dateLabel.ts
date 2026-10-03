/**
 * Every invoice's `date` field (live, from the POS, or the built-in sample
 * data) is a display string like "Sep 3, 2026 · 7:10 PM". Older invoices
 * seeded before the year was added look like "Sep 3 · 7:10 PM" — no year,
 * back when the app just assumed "this year". parseDateLabel reads both
 * formats: the year group is optional, and falls back to the `year`
 * parameter (current year by default) when it's missing, so old invoices
 * keep parsing exactly as they always did.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sep 3, 2026 · 7:10 PM" (or the yearless legacy "Sep 3 · 7:10 PM") -> a timestamp. Returns null if unparseable. */
export function parseDateLabel(label: string, year: number = new Date().getFullYear()): number | null {
  const m = label.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s*·\s*(\d{1,2}):(\d{2})\s*(AM|PM))?/);
  if (!m) return null;
  const [, mon, dayStr, yearStr, hhStr, mmStr, ap] = m;
  const monthIdx = MONTHS.indexOf(mon);
  if (monthIdx < 0) return null;
  let hour = hhStr ? parseInt(hhStr, 10) : 0;
  const minute = mmStr ? parseInt(mmStr, 10) : 0;
  if (ap === "PM" && hour !== 12) hour += 12;
  if (ap === "AM" && hour === 12) hour = 0;
  const effectiveYear = yearStr ? parseInt(yearStr, 10) : year;
  const d = new Date(effectiveYear, monthIdx, parseInt(dayStr, 10), hour, minute, 0, 0);
  return d.getTime();
}

export function formatDDMonYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  return `${dd} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

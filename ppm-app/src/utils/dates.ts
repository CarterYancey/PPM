/**
 * Date helpers.
 *
 * Every date in the data model is a plain calendar date ("2026-08-11"), with no
 * time and no timezone. The scheduler reasons in whole days counted from today.
 *
 * The one rule that matters: parse calendar dates as *local* midnight. Passing
 * "2026-08-11" to `new Date()` parses it as UTC midnight, which is the previous
 * day for anyone west of Greenwich. Mixing that with a local `new Date()` for
 * "now" produced off-by-one-day slack all over the old code.
 */

/** Parse an ISO calendar date ("YYYY-MM-DD") as local midnight. */
export function parseCalendarDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/** Format a Date as an ISO calendar date, in local time. */
export function toCalendarDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Local midnight of the given instant. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days between two instants, ignoring the time of day.
 * `calendarDaysBetween(now, tomorrow) === 1` regardless of the clock.
 */
export function calendarDaysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  // Divide before rounding so DST transitions (23h/25h days) don't drift.
  return Math.round((b - a) / 86_400_000);
}

/** Day offset (0 = today) of a calendar date string, or undefined if unset/invalid. */
export function dayOffsetOf(iso: string | undefined, today: Date): number | undefined {
  if (!iso) return undefined;
  const parsed = parseCalendarDate(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return calendarDaysBetween(today, parsed);
}

/** The Date for a day offset from today (0 = today). */
export function dateForDayOffset(offset: number, today: Date): Date {
  const base = startOfLocalDay(today);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
}

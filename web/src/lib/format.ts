import { format, parseISO } from 'date-fns';

/**
 * Days are UTC calendar days on the server, so date-only strings are formatted
 * without applying the browser's timezone. Parsing "2026-08-15" as a local date
 * would shift it a day for anyone west of UTC.
 */
export const formatDateKey = (dateKey: string, pattern = 'd MMM') =>
  format(parseISO(`${dateKey}T00:00:00`), pattern);

export const formatTime = (isoTimestamp: string) => format(parseISO(isoTimestamp), 'HH:mm');

export const formatDateTime = (isoTimestamp: string) =>
  format(parseISO(isoTimestamp), 'd MMM, HH:mm');

/**
 * The day key for a Date, read off the user's own calendar.
 *
 * Deliberately not `toISOString().slice(0, 10)`, which gives the UTC day: at
 * 00:30 in Delhi that returns yesterday, so "Today" would filter to the wrong
 * date and a meal logged after midnight would be counted against the day before.
 */
export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;

export const todayKey = () => toDateKey(new Date());

export function daysAgoKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

/** Whole numbers for calories; nobody needs 412.37 kcal. */
export const formatCalories = (value: number) => Math.round(value).toLocaleString();

export const formatGrams = (value: number) =>
  value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();

export const formatAmount = (value: number) =>
  value >= 100 ? Math.round(value).toLocaleString() : String(Math.round(value * 100) / 100);

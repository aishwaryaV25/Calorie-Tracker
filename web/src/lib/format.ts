import { format, parseISO } from 'date-fns';

export const formatDateKey = (dateKey: string, pattern = 'd MMM') =>
  format(parseISO(`${dateKey}T00:00:00`), pattern);

export const formatTime = (isoTimestamp: string) => format(parseISO(isoTimestamp), 'HH:mm');

export const formatClock = (isoTimestamp: string) => format(parseISO(isoTimestamp), 'h:mm a');

export const formatDateTime = (isoTimestamp: string) =>
  format(parseISO(isoTimestamp), 'd MMM, HH:mm');

// Local Y-M-D. toISOString() is UTC and shifts after midnight in India.
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

export const formatCalories = (value: number) => Math.round(value).toLocaleString();

export const formatGrams = (value: number) =>
  value >= 100 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();

export const formatAmount = (value: number) =>
  value >= 100 ? Math.round(value).toLocaleString() : String(Math.round(value * 100) / 100);

/**
 * Day-bucketing helpers.
 *
 * Assumption, documented in the README: a "day" is the eater's own calendar day.
 * The client decides which day an entry belongs to and sends it as `consumedOn`;
 * the server stores that date at midnight UTC purely as a stable key to group
 * and compare by, never as a moment in time.
 *
 * Deriving the day from the timestamp instead would be wrong for anyone away
 * from UTC: a 00:30 supper in Delhi is 19:00 the previous day in UTC, and would
 * be counted against yesterday's calories.
 *
 * The functions below therefore work in UTC deliberately — they operate on keys
 * that are already anchored there, not on local wall-clock time.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC on the same calendar day as `value`. */
export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** Turns a "YYYY-MM-DD" key into the Date used to store and compare that day. */
export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

/** ISO calendar date, e.g. "2026-08-15". Used as the key in report responses. */
export function toDateKey(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

/** Monday of the ISO week containing `value`, at midnight UTC. */
export function startOfIsoWeek(value: Date): Date {
  const day = startOfUtcDay(value);
  const weekday = day.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(day, -daysSinceMonday);
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.round((startOfUtcDay(later).getTime() - startOfUtcDay(earlier).getTime()) / MS_PER_DAY);
}

/** Every day from `from` to `to` inclusive, so reports can render empty days as zero. */
export function eachDayInRange(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInDays(to, from);

  for (let offset = 0; offset <= total; offset += 1) {
    days.push(addDays(startOfUtcDay(from), offset));
  }

  return days;
}

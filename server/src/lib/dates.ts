/**
 * Day-bucketing helpers.
 *
 * Assumption, documented in the README: a "day" is a UTC calendar day. Nutrition
 * totals are only meaningful when every entry agrees on where a day starts, and
 * anchoring to UTC keeps aggregation deterministic regardless of where the
 * request came from. Supporting per-user time zones would mean storing an offset
 * on the user and shifting the bucket key at write time.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC on the same calendar day as `value`. */
export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
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

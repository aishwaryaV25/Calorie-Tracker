// Date keys are the eater's calendar day, stored at midnight UTC.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function fromDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

export function toDateKey(value: Date): string {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

export function startOfIsoWeek(value: Date): Date {
  const day = startOfUtcDay(value);
  const weekday = day.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return addDays(day, -daysSinceMonday);
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.round((startOfUtcDay(later).getTime() - startOfUtcDay(earlier).getTime()) / MS_PER_DAY);
}

export function eachDayInRange(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const total = differenceInDays(to, from);

  for (let offset = 0; offset <= total; offset += 1) {
    days.push(addDays(startOfUtcDay(from), offset));
  }

  return days;
}

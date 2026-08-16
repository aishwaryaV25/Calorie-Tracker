import { addDays, fromDateKey, startOfIsoWeek, toDateKey } from '../lib/dates.js';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

export interface DateRange {
  from: string;
  to: string;
}

export const REPORT_PERIODS = ['last_week', 'this_week', 'last_7_days', 'this_month', 'last_month'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/**
 * The window a PDF report should cover. Named dates win; otherwise a period;
 * otherwise the previous ISO week — "give me a report" with no dates.
 */
export function resolveReportWindow(input: {
  today: string;
  from?: string;
  to?: string;
  period?: string;
}): DateRange {
  const from = asDateKey(input.from);
  const to = asDateKey(input.to);

  if (from && to) {
    return from <= to ? { from, to } : { from: to, to: from };
  }

  if (from) {
    return { from, to: input.today };
  }

  if (to) {
    return { from: to, to };
  }

  const period = (REPORT_PERIODS as readonly string[]).includes(input.period ?? '')
    ? (input.period as ReportPeriod)
    : 'last_week';

  if (period === 'last_7_days') {
    return { from: toDateKey(addDays(fromDateKey(input.today), -6)), to: input.today };
  }

  const spoken: Record<Exclude<ReportPeriod, 'last_7_days'>, string> = {
    last_week: 'last week',
    this_week: 'this week',
    this_month: 'this month',
    last_month: 'last month',
  };

  return resolveDateRange(spoken[period], input.today) ?? {
    from: toDateKey(addDays(fromDateKey(input.today), -6)),
    to: input.today,
  };
}

function asDateKey(value?: string): string | undefined {
  const candidate = value?.trim().slice(0, 10);
  if (!candidate || !DATE_KEY.test(candidate) || Number.isNaN(Date.parse(candidate))) {
    return undefined;
  }
  return candidate;
}

/**
 * Turns a spoken day or window into YYYY-MM-DD keys, anchored on the caller's
 * own calendar day. The model is not asked to do this arithmetic.
 */
export function resolveDateRange(text: string, today: string): DateRange | null {
  const day = resolveDate(text, today);
  if (day) {
    return { from: day, to: day };
  }

  const normalised = text.trim().toLowerCase();

  if (/\bthis week\b/.test(normalised)) {
    const monday = toDateKey(startOfIsoWeek(fromDateKey(today)));
    return { from: monday, to: today };
  }

  if (/\blast week\b/.test(normalised)) {
    const thisMonday = startOfIsoWeek(fromDateKey(today));
    const lastMonday = addDays(thisMonday, -7);
    return { from: toDateKey(lastMonday), to: toDateKey(addDays(lastMonday, 6)) };
  }

  if (/\bthis month\b/.test(normalised)) {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  if (/\blast month\b/.test(normalised)) {
    const firstOfThis = fromDateKey(`${today.slice(0, 7)}-01`);
    const lastOfPrev = addDays(firstOfThis, -1);
    const firstOfPrev = `${toDateKey(lastOfPrev).slice(0, 7)}-01`;
    return { from: firstOfPrev, to: toDateKey(lastOfPrev) };
  }

  return null;
}

export function resolveDate(text: string, today: string): string | null {
  const normalised = text.trim().toLowerCase();

  if (DATE_KEY.test(normalised)) {
    return Number.isNaN(Date.parse(normalised)) ? null : normalised;
  }

  if (/\btoday\b/.test(normalised)) {
    return today;
  }

  if (/\byesterday\b/.test(normalised)) {
    return toDateKey(addDays(fromDateKey(today), -1));
  }

  if (/\btomorrow\b/.test(normalised)) {
    return toDateKey(addDays(fromDateKey(today), 1));
  }

  const weekday = lastWeekday(normalised, today);
  if (weekday) {
    return weekday;
  }

  const named = namedCalendarDay(normalised, today);
  if (named) {
    return named;
  }

  const iso = normalised.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const isoDay = iso?.[1];
  if (isoDay && !Number.isNaN(Date.parse(isoDay))) {
    return isoDay;
  }

  return null;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function lastWeekday(text: string, today: string): string | null {
  const match = text.match(
    /\b(?:last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );

  if (!match) {
    return null;
  }

  const target = WEEKDAYS.indexOf(match[1] as (typeof WEEKDAYS)[number]);
  const current = fromDateKey(today);
  const currentDow = current.getUTCDay();
  let delta = (currentDow - target + 7) % 7;

  if (delta === 0 && /\blast\b/.test(text)) {
    delta = 7;
  } else if (delta === 0) {
    return today;
  }

  return toDateKey(addDays(current, -delta));
}

/** "august 14" or "14 august", using the year of `today` unless that day is still ahead. */
function namedCalendarDay(text: string, today: string): string | null {
  const match =
    text.match(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/,
    ) ??
    text.match(
      /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b/,
    );

  if (!match) {
    return null;
  }

  const monthName = (Number.isFinite(Number(match[1])) ? match[2] : match[1]) ?? '';
  const day = Number(Number.isFinite(Number(match[1])) ? match[1] : match[2]);
  const month = MONTHS[monthName];

  if (!month || day < 1 || day > 31) {
    return null;
  }

  const year = Number(today.slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  if (Number.isNaN(Date.parse(candidate))) {
    return null;
  }

  return candidate;
}

'use client';

import { DateField, Field, cx } from '@/components/ui';
import { daysAgoKey, formatDateKey, todayKey } from '@/lib/format';

export type ReportPreset = 'today' | '7' | '30' | '90' | 'custom';

export interface DateRange {
  from: string;
  to: string;
  preset: ReportPreset;
}

const PRESETS: { id: Exclude<ReportPreset, 'custom'>; label: string; from: () => string; to: () => string }[] =
  [
    { id: 'today', label: 'Today', from: todayKey, to: todayKey },
    { id: '7', label: 'Last 7 days', from: () => daysAgoKey(6), to: todayKey },
    { id: '30', label: 'Last 30 days', from: () => daysAgoKey(29), to: todayKey },
    { id: '90', label: 'Last 90 days', from: () => daysAgoKey(89), to: todayKey },
  ];

/** Earlier date first. Typing 18 then 16 still becomes 16 → 18. */
export function normalizeRange(from: string, to: string): { from: string; to: string } {
  if (from && to && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

const presetRange = (id: Exclude<ReportPreset, 'custom'>): DateRange => {
  const preset = PRESETS.find((item) => item.id === id)!;
  return { preset: id, from: preset.from(), to: preset.to() };
};

export const defaultRange = (): DateRange => presetRange('30');

export function queryRange(range: DateRange): { from: string; to: string } {
  return { from: range.from, to: range.to };
}

/** Inclusive day count, or null while a date input is empty. */
export function rangeDays(range: DateRange): number | null {
  const { from, to } = normalizeRange(range.from, range.to);
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Date range for the charts and the PDF. Custom dates stay hidden until that
 * pill is on, same as Entries.
 */
export function ReportRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const isCustom = value.preset === 'custom';

  function applyCustom(from: string, to: string) {
    onChange({ preset: 'custom', ...normalizeRange(from, to) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Date range</p>
        <p className="mt-1 text-sm text-muted">Applies to the charts below and to the PDF.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={value.preset === preset.id}
            onClick={() => onChange(presetRange(preset.id))}
            className={cx(
              'rounded-full px-3 py-1.5 text-xs transition-colors',
              value.preset === preset.id
                ? 'bg-foreground text-surface'
                : 'border border-border-strong text-muted hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() =>
            applyCustom(value.from || daysAgoKey(6), value.to || todayKey())
          }
          className={cx(
            'rounded-full px-3 py-1.5 text-xs transition-colors',
            isCustom
              ? 'bg-foreground text-surface'
              : 'border border-border-strong text-muted hover:text-foreground',
          )}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="From" htmlFor="report-from">
            <DateField
              id="report-from"
              value={value.from}
              onChange={(from) => applyCustom(from, value.to)}
            />
          </Field>
          <Field label="To" htmlFor="report-to">
            <DateField
              id="report-to"
              value={value.to}
              onChange={(to) => applyCustom(value.from, to)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}

export function rangeLabel(range: DateRange): string {
  if (!range.from || !range.to) {
    return 'Pick both dates';
  }

  const { from, to } = normalizeRange(range.from, range.to);
  const days = rangeDays({ ...range, from, to });
  const span = `${formatDateKey(from, 'd MMM yyyy')} – ${formatDateKey(to, 'd MMM yyyy')}`;

  return days ? `${span} · ${days} ${days === 1 ? 'day' : 'days'}` : span;
}

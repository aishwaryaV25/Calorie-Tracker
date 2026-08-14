'use client';

import { cx, Input } from '@/components/ui';
import { daysAgoKey, todayKey } from '@/lib/format';

export interface DateRange {
  from: string;
  to: string;
}

/** Windows worth one click. Capped at 90 days so one page of the daily report
 *  covers the whole range (the API allows at most 100 rows per page). */
const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const;

const presetRange = (days: number): DateRange => ({
  from: daysAgoKey(days - 1),
  to: todayKey(),
});

export const defaultRange = (): DateRange => presetRange(30);

/** Inclusive day count, or null while a date input is empty or malformed. */
export function rangeDays(range: DateRange): number | null {
  const from = Date.parse(`${range.from}T00:00:00Z`);
  const to = Date.parse(`${range.to}T00:00:00Z`);

  if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
    return null;
  }

  return Math.round((to - from) / 86_400_000) + 1;
}

/**
 * Range control shared by every report on the page. Presets cover the common
 * cases; the two date fields stay visible so a custom window is never more than
 * a click away.
 */
export function ReportRangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  // A preset is "active" when the current range happens to equal it, so typing
  // the same dates by hand highlights it too.
  const activeDays = PRESETS.find((preset) => {
    const candidate = presetRange(preset.days);
    return candidate.from === value.from && candidate.to === value.to;
  })?.days;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            type="button"
            aria-pressed={activeDays === preset.days}
            onClick={() => onChange(presetRange(preset.days))}
            className={cx(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              activeDays === preset.days
                ? 'bg-foreground text-surface'
                : 'border border-border-strong bg-surface text-muted hover:bg-surface-raised',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-subtle">
          From
          <Input
            type="date"
            className="w-auto text-xs"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => onChange({ ...value, from: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-subtle">
          To
          <Input
            type="date"
            className="w-auto text-xs"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => onChange({ ...value, to: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

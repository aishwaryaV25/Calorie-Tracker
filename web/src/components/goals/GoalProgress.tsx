'use client';

import { cx } from '@/components/ui';
import { formatCalories, formatGrams } from '@/lib/format';

interface ProgressRow {
  label: string;
  actual: number;
  target: number;
  unit: string;
  format: (value: number) => string;
}

function ProgressBar({ row }: { row: ProgressRow }) {
  const ratio = row.target > 0 ? row.actual / row.target : 0;
  const isOver = ratio > 1;
  const remaining = row.target - row.actual;

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{row.label}</span>
        <span className="tabular-nums">
          <span className={cx(isOver && 'text-danger')}>{row.format(row.actual)}</span>
          <span className="text-subtle">
            {' / '}
            {row.format(row.target)} {row.unit}
          </span>
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={`${row.label} progress`}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
      >
        {/* Capped at full width so an overshoot colours the bar instead of overflowing it. */}
        <div
          className={cx('h-full rounded-full transition-[width]', isOver ? 'bg-accent' : 'bg-foreground')}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </div>

      <p className="text-xs text-subtle">
        {isOver
          ? `${row.format(Math.abs(remaining))} ${row.unit} over`
          : `${row.format(remaining)} ${row.unit} left`}
      </p>
    </li>
  );
}

interface GoalProgressProps {
  target: { dailyCalories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
  actual: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
}

/** Today's intake measured against the targets currently in force. */
export function GoalProgress({ target, actual }: GoalProgressProps) {
  const rows: ProgressRow[] = [
    {
      label: 'Calories',
      actual: actual.calories,
      target: target.dailyCalories,
      unit: 'kcal',
      format: formatCalories,
    },
    {
      label: 'Protein',
      actual: actual.proteinGrams,
      target: target.proteinGrams,
      unit: 'g',
      format: formatGrams,
    },
    {
      label: 'Carbs',
      actual: actual.carbGrams,
      target: target.carbGrams,
      unit: 'g',
      format: formatGrams,
    },
    { label: 'Fat', actual: actual.fatGrams, target: target.fatGrams, unit: 'g', format: formatGrams },
  ];

  return (
    <ul className="flex flex-col gap-4">
      {rows.map((row) => (
        <ProgressBar key={row.label} row={row} />
      ))}
    </ul>
  );
}

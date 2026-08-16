'use client';

import { cx } from '@/components/ui';
import { formatCalories, formatGrams } from '@/lib/format';

interface RingRow {
  label: string;
  short: string;
  actual: number;
  target: number;
  unit: string;
  format: (value: number) => string;
  accent: string;
}

function MiniRing({ ratio, accent }: { ratio: number; accent: string }) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const capped = Math.min(1, Math.max(0, ratio));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-raised)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - capped)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  );
}

interface GoalProgressProps {
  target: { dailyCalories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
  actual: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
}

export function GoalProgress({ target, actual }: GoalProgressProps) {
  const rows: RingRow[] = [
    {
      label: 'Calories',
      short: 'Cal',
      actual: actual.calories,
      target: target.dailyCalories,
      unit: 'kcal',
      format: formatCalories,
      accent: 'var(--foreground)',
    },
    {
      label: 'Protein',
      short: 'P',
      actual: actual.proteinGrams,
      target: target.proteinGrams,
      unit: 'g',
      format: formatGrams,
      accent: 'var(--protein)',
    },
    {
      label: 'Carbs',
      short: 'C',
      actual: actual.carbGrams,
      target: target.carbGrams,
      unit: 'g',
      format: formatGrams,
      accent: 'var(--carbs)',
    },
    {
      label: 'Fat',
      short: 'F',
      actual: actual.fatGrams,
      target: target.fatGrams,
      unit: 'g',
      format: formatGrams,
      accent: 'var(--fat)',
    },
  ];

  const calories = rows[0]!;
  const calRatio = calories.target > 0 ? calories.actual / calories.target : 0;
  const calOver = calRatio > 1;
  const calLeft = calories.target - calories.actual;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex min-w-0 items-center gap-3">
        <MiniRing ratio={calRatio} accent={calOver ? 'var(--accent)' : calories.accent} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Today</p>
          <p className="text-xs text-muted tabular-nums">
            <span className={cx(calOver && 'text-danger')}>{calories.format(calories.actual)}</span>
            {' / '}
            {calories.format(calories.target)} kcal
            <span className="text-subtle">
              {' · '}
              {calOver
                ? `${calories.format(Math.abs(calLeft))} over`
                : `${calories.format(calLeft)} left`}
            </span>
          </p>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 sm:ml-auto">
        {rows.slice(1).map((row) => {
          const ratio = row.target > 0 ? row.actual / row.target : 0;
          const over = ratio > 1;

          return (
            <li key={row.label} className="flex items-center gap-2">
              <MiniRing ratio={ratio} accent={over ? 'var(--accent)' : row.accent} />
              <div>
                <p className="text-xs text-subtle">{row.short}</p>
                <p className="text-sm tabular-nums">
                  <span className={cx(over && 'text-danger')}>{Math.round(Math.min(ratio, 1) * 100)}</span>
                  <span className="text-subtle">%</span>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

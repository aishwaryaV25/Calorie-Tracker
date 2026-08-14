'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatGrams } from '@/lib/format';
import type { MacroBreakdown } from '@/lib/types';

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 16px rgb(17 17 19 / 0.08)',
};

/**
 * Share of energy from each macro as a donut, with the grams alongside.
 *
 * The slices use the percentages the API derives from the 4/4/9 kcal-per-gram
 * convention rather than grams, because equal grams of fat and protein are not
 * equal slices of a day's energy.
 */
export function MacroBreakdownChart({ breakdown }: { breakdown: MacroBreakdown }) {
  const slices = [
    {
      label: 'Protein',
      grams: breakdown.grams.proteinGrams,
      share: breakdown.caloriePercentage.proteinGrams,
      color: 'var(--protein)',
    },
    {
      label: 'Carbs',
      grams: breakdown.grams.carbGrams,
      share: breakdown.caloriePercentage.carbGrams,
      color: 'var(--carbs)',
    },
    {
      label: 'Fat',
      grams: breakdown.grams.fatGrams,
      share: breakdown.caloriePercentage.fatGrams,
      color: 'var(--fat)',
    },
  ];

  const totalGrams = slices.reduce((sum, slice) => sum + slice.grams, 0);

  if (totalGrams === 0) {
    return <p className="py-12 text-center text-sm text-muted">No macros logged in this range.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="h-[180px] w-[180px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="share"
              nameKey="label"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [
                typeof value === 'number' ? `${value}% of energy` : '—',
                String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex w-full flex-col gap-2">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: slice.color }}
            />
            <span className="flex-1 text-muted">{slice.label}</span>
            <span className="tabular-nums text-subtle">{formatGrams(slice.grams)} g</span>
            <span className="w-12 text-right font-semibold tabular-nums">{slice.share}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

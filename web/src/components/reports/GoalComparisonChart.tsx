'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCalories, formatGrams } from '@/lib/format';
import type { GoalComparison } from '@/lib/types';

const AXIS_STYLE = { fill: 'var(--subtle)', fontSize: 11 };

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 16px rgb(17 17 19 / 0.08)',
};

/**
 * Goal versus actual for the whole range.
 *
 * The bars show each total as a percentage of its target rather than raw
 * amounts: calories run in the thousands while macros run in the tens, so a
 * shared axis would flatten the macro bars to nothing. The dashed line marks
 * 100%, and the exact numbers sit in the table underneath.
 */
export function GoalComparisonChart({ comparison }: { comparison: GoalComparison }) {
  if (!comparison.hasGoal || !comparison.adherence) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No goal covered this range, so there is nothing to compare against.
      </p>
    );
  }

  const metrics = [
    {
      label: 'Calories',
      percent: comparison.adherence.calories,
      actual: `${formatCalories(comparison.actual.calories)} kcal`,
      target: `${formatCalories(comparison.target.calories)} kcal`,
    },
    {
      label: 'Protein',
      percent: comparison.adherence.proteinGrams,
      actual: `${formatGrams(comparison.actual.proteinGrams)} g`,
      target: `${formatGrams(comparison.target.proteinGrams)} g`,
    },
    {
      label: 'Carbs',
      percent: comparison.adherence.carbGrams,
      actual: `${formatGrams(comparison.actual.carbGrams)} g`,
      target: `${formatGrams(comparison.target.carbGrams)} g`,
    },
    {
      label: 'Fat',
      percent: comparison.adherence.fatGrams,
      actual: `${formatGrams(comparison.actual.fatGrams)} g`,
      target: `${formatGrams(comparison.target.fatGrams)} g`,
    },
  ];

  // Keeps the 100% line inside the plot even when every total is well under it.
  const upperBound = Math.max(120, ...metrics.map((metric) => Math.ceil(metric.percent / 10) * 10));

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={metrics}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="var(--grid)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, upperBound]}
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={AXIS_STYLE}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-raised)' }}
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--foreground)' }}
            formatter={(value) => [
              typeof value === 'number' ? `${value}% of target` : '—',
              'Logged',
            ]}
          />
          <ReferenceLine
            x={100}
            stroke="var(--accent)"
            strokeDasharray="4 4"
            label={{ value: 'Target', position: 'top', fill: 'var(--accent)', fontSize: 11 }}
          />
          <Bar
            dataKey="percent"
            fill="var(--foreground)"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            <th className="pb-2 font-medium">Metric</th>
            <th className="pb-2 text-right font-medium">Logged</th>
            <th className="pb-2 text-right font-medium">Target</th>
            <th className="pb-2 text-right font-medium">Of target</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label} className="border-b border-border last:border-0">
              <td className="py-2 text-muted">{metric.label}</td>
              <td className="py-2 text-right tabular-nums">{metric.actual}</td>
              <td className="py-2 text-right tabular-nums text-subtle">{metric.target}</td>
              <td className="py-2 text-right font-semibold tabular-nums">{metric.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

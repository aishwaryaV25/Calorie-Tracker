'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCalories, formatDateKey } from '@/lib/format';
import type { DailyReportRow } from '@/lib/types';

const AXIS_STYLE = { fill: 'var(--subtle)', fontSize: 11 };

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 16px rgb(17 17 19 / 0.08)',
};

/**
 * Calories logged per day as bars, with the goal drawn as a line on top so the
 * comparison is readable at a glance. Days over target are coloured differently
 * rather than relying on the reader to compare bar height to the line.
 */
export function CalorieTrendChart({ rows }: { rows: DailyReportRow[] }) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No data for this range yet.</p>;
  }

  const data = rows.map((row) => ({
    date: formatDateKey(row.date),
    calories: row.calories,
    goal: row.goal?.dailyCalories ?? null,
    isOver: row.goal ? row.calories > row.goal.dailyCalories : false,
  }));

  return (
    <ResponsiveContainer width="100%" height={224}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={44} />
        <Tooltip
          cursor={{ fill: 'var(--surface-raised)' }}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--foreground)' }}
          formatter={(value, name) => [
            typeof value === 'number' ? `${formatCalories(value)} kcal` : '—',
            name === 'calories' ? 'Logged' : 'Target',
          ]}
        />
        <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((entry) => (
            <Cell
              key={entry.date}
              // Ink for a normal day, brand red when the day went over target,
              // so the exception stands out without needing a second glance.
              fill={entry.isOver ? 'var(--accent)' : 'var(--foreground)'}
              fillOpacity={entry.calories === 0 ? 0.15 : 1}
            />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="goal"
          stroke="var(--subtle)"
          strokeDasharray="4 4"
          strokeWidth={1.5}
          dot={false}
          // Keeps the line continuous across days with no goal recorded.
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Simple bar chart of weekly totals, used on the reports page. */
export function WeeklyCaloriesChart({
  rows,
}: {
  rows: { weekStart: string; calories: number }[];
}) {
  if (rows.length === 0) {
    return <p className="py-12 text-center text-sm text-muted">No data for this range yet.</p>;
  }

  const data = rows.map((row) => ({
    week: formatDateKey(row.weekStart),
    calories: row.calories,
  }));

  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--grid)" vertical={false} />
        <XAxis dataKey="week" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={52} />
        <Tooltip
          cursor={{ fill: 'var(--surface-raised)' }}
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [
            typeof value === 'number' ? `${formatCalories(value)} kcal` : '—',
            'Week total',
          ]}
        />
        <Bar dataKey="calories" fill="var(--foreground)" radius={[4, 4, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

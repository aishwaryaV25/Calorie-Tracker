'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateKey } from '@/lib/format';
import type { WeightLog } from '@/lib/types';
import { formatKg } from './formatKg';

const TOOLTIP_STYLE = {
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 16px rgb(17 17 19 / 0.08)',
};

export function WeightChart({
  readings,
  targetKg,
}: {
  readings: WeightLog[];
  targetKg: number | null;
}) {
  if (readings.length === 0) {
    return (
      <p className="py-10 text-sm text-white/40">
        The line appears after the first weigh-in.
      </p>
    );
  }

  const chronological = [...readings].sort((a, b) => a.loggedOn.localeCompare(b.loggedOn));
  const lastId = chronological[chronological.length - 1]?.id;
  const data = chronological.map((row) => ({
    id: row.id,
    date: formatDateKey(row.loggedOn),
    kg: row.kg,
    goal: targetKg,
  }));
  const axis = { fill: 'rgba(255,255,255,0.38)', fontSize: 11 };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
        <XAxis dataKey="date" tick={axis} axisLine={false} tickLine={false} />
        <YAxis
          tick={axis}
          axisLine={false}
          tickLine={false}
          width={40}
          domain={['dataMin - 1', 'dataMax + 1']}
          tickFormatter={(value: number) => formatKg(value)}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: 'var(--foreground)' }}
          formatter={(value, name) => [
            typeof value === 'number' ? `${formatKg(value)} kg` : '—',
            name === 'kg' ? 'Weight' : 'Goal',
          ]}
        />
        {targetKg != null && (
          <Line
            type="monotone"
            dataKey="goal"
            stroke="rgba(255,255,255,0.28)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        )}
        <Line
          type="monotone"
          dataKey="kg"
          stroke="rgba(255,255,255,0.92)"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload } = props;
            if (cx == null || cy == null) {
              return <g />;
            }

            const isLast = payload.id === lastId;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={isLast ? 5 : 3}
                fill={isLast ? 'var(--accent)' : 'rgba(255,255,255,0.92)'}
              />
            );
          }}
          activeDot={{ r: 5, fill: 'var(--accent)' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

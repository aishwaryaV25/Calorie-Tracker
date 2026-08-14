'use client';

import { formatAmount } from '@/lib/format';
import type { MicronutrientRow } from '@/lib/types';

/**
 * Vitamin and mineral totals for the range. Amounts stay in the unit the API
 * reports for each nutrient (mg or µg), so nothing is silently rescaled.
 */
export function MicronutrientTable({ rows, days }: { rows: MicronutrientRow[]; days: number }) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No micronutrients recorded in this range. They are filled in automatically when you log a
        meal from a photo.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      {/* First child to keep the markup valid; `caption-bottom` puts it under the rows. */}
      <caption className="caption-bottom pt-3 text-left text-xs text-subtle">
        Averaged over all {days} days in the range, including days with nothing logged.
      </caption>
      <thead>
        <tr className="border-b border-border text-left text-xs text-subtle">
          <th className="pb-2 font-medium">Nutrient</th>
          <th className="pb-2 text-right font-medium">Total</th>
          <th className="pb-2 text-right font-medium">Average per day</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.nutrient} className="border-b border-border last:border-0">
            <td className="py-2">{row.label}</td>
            <td className="py-2 text-right tabular-nums">
              {formatAmount(row.total)} {row.unit}
            </td>
            <td className="py-2 text-right tabular-nums text-subtle">
              {formatAmount(row.averagePerDay)} {row.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

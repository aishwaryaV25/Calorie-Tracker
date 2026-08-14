'use client';

import { Badge, Button } from '@/components/ui';
import { formatCalories, formatDateKey, formatGrams, formatTime } from '@/lib/format';
import { MEAL_LABELS, type FoodEntry } from '@/lib/types';

interface EntriesTableProps {
  entries: FoodEntry[];
  deletingId: string | null;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (entry: FoodEntry) => void;
}

const macroSummary = (entry: FoodEntry) =>
  `${formatGrams(entry.macros.proteinGrams)}p / ${formatGrams(entry.macros.carbGrams)}c / ${formatGrams(entry.macros.fatGrams)}f`;

/**
 * Stacked cards on small screens and a full table on large ones. An entry has
 * nine values worth showing, which a phone-width table cannot fit legibly.
 */
export function EntriesTable({ entries, deletingId, onEdit, onDelete }: EntriesTableProps) {
  return (
    <>
      <ul className="flex flex-col divide-y divide-border lg:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{entry.foodName}</p>
                  <Badge>{MEAL_LABELS[entry.mealType]}</Badge>
                  {entry.source !== 'manual' && <Badge tone="accent">{entry.source}</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateKey(entry.consumedOn)} at {formatTime(entry.consumedAt)} ·{' '}
                  {entry.quantity} {entry.unit}
                </p>
                <p className="text-xs text-subtle">{macroSummary(entry)}</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatCalories(entry.calories)}
                <span className="ml-1 text-xs font-normal text-subtle">kcal</span>
              </span>
            </div>

            <div className="flex gap-1">
              <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => onEdit(entry)}>
                Edit
              </Button>
              <Button
                variant="danger"
                className="px-2 py-1 text-xs"
                isLoading={deletingId === entry.id}
                onClick={() => onDelete(entry)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th className="pb-2 font-medium">When</th>
              <th className="pb-2 font-medium">Food</th>
              <th className="pb-2 font-medium">Meal</th>
              <th className="pb-2 text-right font-medium">Quantity</th>
              <th className="pb-2 text-right font-medium">Calories</th>
              <th className="pb-2 text-right font-medium">Protein</th>
              <th className="pb-2 text-right font-medium">Carbs</th>
              <th className="pb-2 text-right font-medium">Fat</th>
              <th className="pb-2 text-right font-medium">Micros</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="py-2.5 whitespace-nowrap text-muted">
                  {formatDateKey(entry.consumedOn)}, {formatTime(entry.consumedAt)}
                </td>
                <td className="max-w-xs py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{entry.foodName}</span>
                    {entry.source !== 'manual' && <Badge tone="accent">{entry.source}</Badge>}
                  </div>
                </td>
                <td className="py-2.5">{MEAL_LABELS[entry.mealType]}</td>
                <td className="py-2.5 text-right whitespace-nowrap tabular-nums">
                  {entry.quantity} {entry.unit}
                </td>
                <td className="py-2.5 text-right font-medium tabular-nums">
                  {formatCalories(entry.calories)}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatGrams(entry.macros.proteinGrams)}g
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatGrams(entry.macros.carbGrams)}g
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatGrams(entry.macros.fatGrams)}g
                </td>
                <td
                  className="py-2.5 text-right tabular-nums text-muted"
                  title={entry.micronutrients.map((micro) => micro.label).join(', ')}
                >
                  {entry.micronutrients.length || '—'}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => onEdit(entry)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs hover:text-danger"
                    isLoading={deletingId === entry.id}
                    onClick={() => onDelete(entry)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

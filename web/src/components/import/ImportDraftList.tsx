'use client';

import { DateField, Select } from '@/components/ui';
import { MEAL_LABELS, MEAL_TYPES, type ImportDraftRow, type MealType } from '@/lib/types';

const CELL =
  'h-9 w-full rounded-md bg-transparent px-2 text-sm outline-none hover:bg-surface-raised focus:bg-surface-raised';

export function ImportDraftList({
  rows,
  onChange,
  onRemove,
}: {
  rows: ImportDraftRow[];
  onChange: (index: number, patch: Partial<ImportDraftRow>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-subtle">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-3 py-3 font-medium">Meal</th>
            <th className="px-3 py-3 font-medium">Food</th>
            <th className="px-3 py-3 text-right font-medium">Qty</th>
            <th className="px-3 py-3 font-medium">Unit</th>
            <th className="px-3 py-3 text-right font-medium">Cal</th>
            <th className="px-3 py-3 text-right font-medium">P</th>
            <th className="px-3 py-3 text-right font-medium">C</th>
            <th className="px-3 py-3 text-right font-medium">F</th>
            <th className="px-3 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.foodName}-${index}`} className="border-b border-border/70 last:border-0">
              <td className="w-[9.5rem] px-3 py-2">
                <DateField
                  quiet
                  value={row.consumedOn}
                  onChange={(consumedOn) => onChange(index, { consumedOn })}
                />
              </td>
              <td className="w-[8.5rem] px-2 py-2">
                <Select
                  quiet
                  value={row.mealType}
                  onChange={(event) => onChange(index, { mealType: event.target.value as MealType })}
                >
                  {MEAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {MEAL_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </td>
              <td className="px-2 py-2">
                <input
                  className={CELL}
                  title={row.foodName}
                  value={row.foodName}
                  onChange={(event) => onChange(index, { foodName: event.target.value })}
                />
              </td>
              <td className="w-[4.5rem] px-2 py-2">
                <NumberCell
                  value={row.quantity}
                  onChange={(quantity) => onChange(index, { quantity })}
                />
              </td>
              <td className="w-[5rem] px-2 py-2">
                <input
                  className={CELL}
                  value={row.unit}
                  onChange={(event) => onChange(index, { unit: event.target.value })}
                />
              </td>
              <td className="w-[4.75rem] px-2 py-2">
                <NumberCell
                  value={row.calories}
                  onChange={(calories) => onChange(index, { calories })}
                />
              </td>
              <td className="w-[4.25rem] px-2 py-2">
                <NumberCell
                  value={row.proteinGrams}
                  onChange={(proteinGrams) => onChange(index, { proteinGrams })}
                />
              </td>
              <td className="w-[4.25rem] px-2 py-2">
                <NumberCell
                  value={row.carbGrams}
                  onChange={(carbGrams) => onChange(index, { carbGrams })}
                />
              </td>
              <td className="w-[4.25rem] px-2 py-2">
                <NumberCell
                  value={row.fatGrams}
                  onChange={(fatGrams) => onChange(index, { fatGrams })}
                />
              </td>
              <td className="w-[2.75rem] px-2 py-2 text-center">
                <button
                  type="button"
                  aria-label={`Remove ${row.foodName || 'entry'}`}
                  className="grid size-8 place-items-center rounded-md text-lg leading-none text-subtle hover:bg-surface-raised hover:text-danger"
                  onClick={() => onRemove(index)}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      className={`${CELL} text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

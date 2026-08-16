'use client';

import type { ReactNode } from 'react';
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
    <>
    <ul className="flex flex-col gap-3 lg:hidden">
      {rows.map((row, index) => (
        <li
          key={`${row.foodName}-${index}`}
          className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 text-sm font-medium">{row.foodName || 'Untitled'}</p>
            <button
              type="button"
              aria-label={`Remove ${row.foodName || 'entry'}`}
              className="grid size-8 shrink-0 place-items-center rounded-md text-lg leading-none text-subtle hover:bg-surface-raised hover:text-danger"
              onClick={() => onRemove(index)}
            >
              ×
            </button>
          </div>
          <input
            className={`${CELL} mt-1 px-0`}
            title={row.foodName}
            value={row.foodName}
            onChange={(event) => onChange(index, { foodName: event.target.value })}
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <DateField
              quiet
              value={row.consumedOn}
              onChange={(consumedOn) => onChange(index, { consumedOn })}
            />
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
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <MobileField label="Qty">
              <NumberCell value={row.quantity} onChange={(quantity) => onChange(index, { quantity })} />
            </MobileField>
            <MobileField label="Unit">
              <input
                className={CELL}
                value={row.unit}
                onChange={(event) => onChange(index, { unit: event.target.value })}
              />
            </MobileField>
            <MobileField label="kcal">
              <NumberCell value={row.calories} onChange={(calories) => onChange(index, { calories })} />
            </MobileField>
            <MobileField label="Protein">
              <NumberCell
                value={row.proteinGrams}
                onChange={(proteinGrams) => onChange(index, { proteinGrams })}
              />
            </MobileField>
            <MobileField label="Carbs">
              <NumberCell value={row.carbGrams} onChange={(carbGrams) => onChange(index, { carbGrams })} />
            </MobileField>
            <MobileField label="Fat">
              <NumberCell value={row.fatGrams} onChange={(fatGrams) => onChange(index, { fatGrams })} />
            </MobileField>
          </div>
        </li>
      ))}
    </ul>
    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(17_17_19/0.04)] lg:block">
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
    </>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-subtle">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
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

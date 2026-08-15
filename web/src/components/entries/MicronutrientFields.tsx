'use client';

import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { MICRONUTRIENT_KEYS, MICRONUTRIENTS, type Micronutrient } from '@/lib/types';

/**
 * Assignment meal entries include micronutrients. This is the field the user
 * fills, not a read-only chip list after AI has run.
 */
export function MicronutrientFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: Micronutrient[];
  onChange: (next: Micronutrient[]) => void;
}) {
  const unused = MICRONUTRIENT_KEYS.filter((key) => !value.some((item) => item.nutrient === key));
  const [draftKey, setDraftKey] = useState<string>(unused[0] ?? '');
  const [draftAmount, setDraftAmount] = useState('');

  function addNutrient() {
    if (!draftKey || draftAmount.trim() === '') {
      return;
    }

    const meta = MICRONUTRIENTS[draftKey as keyof typeof MICRONUTRIENTS];
    if (!meta) {
      return;
    }

    onChange([
      ...value.filter((item) => item.nutrient !== draftKey),
      { nutrient: draftKey, label: meta.label, amount: Number(draftAmount), unit: meta.unit },
    ]);

    const remaining = unused.filter((key) => key !== draftKey);
    setDraftKey(remaining[0] ?? '');
    setDraftAmount('');
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Micronutrients</legend>
      <p className="text-xs text-subtle">Vitamins and minerals for this food, if you have them.</p>

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.map((item) => (
            <li key={item.nutrient} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
              <span className="truncate text-sm">{item.label}</span>
              <Input
                id={`${idPrefix}-${item.nutrient}`}
                type="number"
                step="any"
                min="0"
                value={String(item.amount)}
                aria-label={`${item.label} amount in ${item.unit}`}
                onChange={(event) =>
                  onChange(
                    value.map((nutrient) =>
                      nutrient.nutrient === item.nutrient
                        ? { ...nutrient, amount: Number(event.target.value) }
                        : nutrient,
                    ),
                  )
                }
              />
              <span className="flex items-center gap-2 text-xs text-muted">
                {item.unit}
                <button
                  type="button"
                  className="text-muted hover:text-danger"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => onChange(value.filter((nutrient) => nutrient.nutrient !== item.nutrient))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {unused.length > 0 && (
        <div className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
          <Select
            id={`${idPrefix}-add-nutrient`}
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
          >
            {unused.map((key) => (
              <option key={key} value={key}>
                {MICRONUTRIENTS[key].label}
              </option>
            ))}
          </Select>
          <Input
            id={`${idPrefix}-add-amount`}
            type="number"
            step="any"
            min="0"
            value={draftAmount}
            placeholder="Amt"
            aria-label="Micronutrient amount"
            onChange={(event) => setDraftAmount(event.target.value)}
          />
          <Button type="button" variant="secondary" className="px-3" onClick={addNutrient}>
            Add
          </Button>
        </div>
      )}
    </fieldset>
  );
}

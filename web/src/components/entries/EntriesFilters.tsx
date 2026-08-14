'use client';

import { Button, Field, Input, Select, cx } from '@/components/ui';
import { daysAgoKey, todayKey } from '@/lib/format';
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/lib/types';

export interface EntryFilterState {
  from: string;
  to: string;
  mealType: MealType | '';
  search: string;
  sort: 'consumedAt' | 'calories' | 'createdAt';
  order: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: EntryFilterState = {
  from: '',
  to: '',
  mealType: '',
  search: '',
  sort: 'consumedAt',
  order: 'desc',
};

/** Ranges people actually ask for, so the common case is one click. */
const RANGE_PRESETS: { label: string; from: () => string; to: () => string }[] = [
  { label: 'Today', from: todayKey, to: todayKey },
  { label: 'Last 7 days', from: () => daysAgoKey(6), to: todayKey },
  { label: 'Last 30 days', from: () => daysAgoKey(29), to: todayKey },
];

interface EntriesFiltersProps {
  value: EntryFilterState;
  onChange: (next: EntryFilterState) => void;
}

export function EntriesFilters({ value, onChange }: EntriesFiltersProps) {
  const set = <K extends keyof EntryFilterState>(key: K, next: EntryFilterState[K]) =>
    onChange({ ...value, [key]: next });

  const isDefault = JSON.stringify(value) === JSON.stringify(DEFAULT_FILTERS);
  const activeRange = RANGE_PRESETS.find(
    (preset) => preset.from() === value.from && preset.to() === value.to,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange({ ...value, from: preset.from(), to: preset.to() })}
            className={cx(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              activeRange?.label === preset.label
                ? 'border-foreground bg-foreground text-surface'
                : 'border-border-strong text-muted hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}

        {!isDefault && (
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => onChange(DEFAULT_FILTERS)}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Field label="From" htmlFor="from">
          <Input
            id="from"
            type="date"
            value={value.from}
            max={value.to || undefined}
            onChange={(event) => set('from', event.target.value)}
          />
        </Field>

        <Field label="To" htmlFor="to">
          <Input
            id="to"
            type="date"
            value={value.to}
            min={value.from || undefined}
            onChange={(event) => set('to', event.target.value)}
          />
        </Field>

        <Field label="Meal" htmlFor="mealType">
          <Select
            id="mealType"
            value={value.mealType}
            onChange={(event) => set('mealType', event.target.value as MealType | '')}
          >
            <option value="">All meals</option>
            {MEAL_TYPES.map((meal) => (
              <option key={meal} value={meal}>
                {MEAL_LABELS[meal]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Search" htmlFor="search">
          <Input
            id="search"
            type="search"
            placeholder="Food name"
            value={value.search}
            onChange={(event) => set('search', event.target.value)}
          />
        </Field>

        <Field label="Sort by" htmlFor="sort">
          <Select
            id="sort"
            value={value.sort}
            onChange={(event) => set('sort', event.target.value as EntryFilterState['sort'])}
          >
            <option value="consumedAt">When eaten</option>
            <option value="calories">Calories</option>
            <option value="createdAt">When added</option>
          </Select>
        </Field>

        <Field label="Order" htmlFor="order">
          <Select
            id="order"
            value={value.order}
            onChange={(event) => set('order', event.target.value as EntryFilterState['order'])}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </Select>
        </Field>
      </div>
    </div>
  );
}

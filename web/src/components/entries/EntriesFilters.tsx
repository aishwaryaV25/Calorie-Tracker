'use client';

import { Button, DateField, Field, Input, Select, cx } from '@/components/ui';
import { daysAgoKey, todayKey } from '@/lib/format';
import { MEAL_LABELS, MEAL_TYPES, type MealType } from '@/lib/types';

export type EntryRange = 'today' | '7' | '30' | 'custom';

export interface EntryFilterState {
  from: string;
  to: string;
  range: EntryRange;
  mealType: MealType | '';
  search: string;
  sort: 'consumedAt' | 'calories' | 'createdAt';
  order: 'asc' | 'desc';
}

export const defaultFilters = (): EntryFilterState => ({
  from: daysAgoKey(6),
  to: todayKey(),
  range: '7',
  mealType: '',
  search: '',
  sort: 'consumedAt',
  order: 'desc',
});

const RANGE_PRESETS: { id: Exclude<EntryRange, 'custom'>; label: string; from: () => string; to: () => string }[] = [
  { id: 'today', label: 'Today', from: todayKey, to: todayKey },
  { id: '7', label: 'Last 7 days', from: () => daysAgoKey(6), to: todayKey },
  { id: '30', label: 'Last 30 days', from: () => daysAgoKey(29), to: todayKey },
];

const SORT_OPTIONS: { label: string; sort: EntryFilterState['sort']; order: EntryFilterState['order'] }[] =
  [
    { label: 'Newest first', sort: 'consumedAt', order: 'desc' },
    { label: 'Oldest first', sort: 'consumedAt', order: 'asc' },
    { label: 'Highest calories', sort: 'calories', order: 'desc' },
    { label: 'Lowest calories', sort: 'calories', order: 'asc' },
    { label: 'Recently added', sort: 'createdAt', order: 'desc' },
  ];

interface EntriesFiltersProps {
  value: EntryFilterState;
  onChange: (next: EntryFilterState) => void;
}

export function EntriesFilters({ value, onChange }: EntriesFiltersProps) {
  const set = <K extends keyof EntryFilterState>(key: K, next: EntryFilterState[K]) =>
    onChange({ ...value, [key]: next });

  const isDefault = JSON.stringify(value) === JSON.stringify(defaultFilters());
  const isCustom = value.range === 'custom';
  const sortValue = `${value.sort}:${value.order}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={value.range === preset.id}
            onClick={() =>
              onChange({ ...value, range: preset.id, from: preset.from(), to: preset.to() })
            }
            className={cx(
              'rounded-full px-3 py-1.5 text-xs transition-colors',
              value.range === preset.id
                ? 'bg-foreground text-surface'
                : 'border border-border-strong text-muted hover:text-foreground',
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() =>
            onChange({
              ...value,
              range: 'custom',
              from: value.from || daysAgoKey(6),
              to: value.to || todayKey(),
            })
          }
          className={cx(
            'rounded-full px-3 py-1.5 text-xs transition-colors',
            isCustom
              ? 'bg-foreground text-surface'
              : 'border border-border-strong text-muted hover:text-foreground',
          )}
        >
          Custom
        </button>

        {!isDefault && (
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onChange(defaultFilters())}>
            Reset
          </Button>
        )}
      </div>

      {isCustom && (
        <div className="grid gap-3 sm:grid-cols-2" data-entries="custom-range">
          <Field label="From" htmlFor="from">
            <DateField
              id="from"
              value={value.from}
              onChange={(from) => onChange({ ...value, range: 'custom', from })}
            />
          </Field>
          <Field label="To" htmlFor="to">
            <DateField
              id="to"
              value={value.to}
              onChange={(to) => onChange({ ...value, range: 'custom', to })}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

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

        <Field label="Sort" htmlFor="sort">
          <Select
            id="sort"
            value={sortValue}
            onChange={(event) => {
              const [sort, order] = event.target.value.split(':') as [
                EntryFilterState['sort'],
                EntryFilterState['order'],
              ];
              onChange({ ...value, sort, order });
            }}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={`${option.sort}:${option.order}`} value={`${option.sort}:${option.order}`}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCalories, formatGrams } from '@/lib/format';
import { Alert, Button, Card, EmptyState, Pagination, Select, Skeleton } from '@/components/ui';
import {
  DEFAULT_FILTERS,
  EntriesFilters,
  type EntryFilterState,
} from '@/components/entries/EntriesFilters';
import { EntriesTable } from '@/components/entries/EntriesTable';
import { EntryFormModal } from '@/components/entries/EntryFormModal';
import type { FoodEntry } from '@/lib/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // One request when typing stops, rather than one per keystroke.
  const search = useDebouncedValue(filters.search, 300);

  const aiStatus = useAsync(() => api.ai.status(), []);

  const entries = useAsync(
    () =>
      api.entries.list({
        page,
        pageSize,
        from: filters.from || undefined,
        to: filters.to || undefined,
        mealType: filters.mealType || undefined,
        search: search || undefined,
        sort: filters.sort,
        order: filters.order,
      }),
    [
      page,
      pageSize,
      filters.from,
      filters.to,
      filters.mealType,
      filters.sort,
      filters.order,
      search,
      revision,
    ],
  );

  /**
   * Any filter change returns to page one: staying on page 4 of a result set
   * that now has two pages would show an empty list for no obvious reason.
   */
  function applyFilters(next: EntryFilterState) {
    setFilters(next);
    setPage(1);
  }

  async function handleDelete(entry: FoodEntry) {
    if (!window.confirm(`Delete "${entry.foodName}"?`)) {
      return;
    }

    setActionError(null);
    setDeletingId(entry.id);

    try {
      await api.entries.remove(entry.id);
      setRevision((value) => value + 1);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  const rows = entries.data?.data ?? [];
  const meta = entries.data?.meta;
  const totals = entries.data?.totals;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Entries</h1>
          <p className="text-sm text-muted">
            Every meal you have logged, filtered by date range, meal type or name.
          </p>
        </div>
        <Link href="/log">
          <Button>Log a meal</Button>
        </Link>
      </header>

      <Card>
        <EntriesFilters value={filters} onChange={applyFilters} />
      </Card>

      {totals && meta && meta.totalItems > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryTile label="Entries" value={meta.totalItems.toLocaleString()} />
          <SummaryTile label="Calories" value={`${formatCalories(totals.calories)} kcal`} />
          <SummaryTile label="Protein" value={`${formatGrams(totals.proteinGrams)} g`} />
          <SummaryTile label="Carbs" value={`${formatGrams(totals.carbGrams)} g`} />
          <SummaryTile label="Fat" value={`${formatGrams(totals.fatGrams)} g`} />
        </div>
      )}

      {actionError && <Alert>{actionError}</Alert>}
      {entries.error && <Alert>{entries.error}</Alert>}

      <Card
        title="Results"
        description={
          meta
            ? `Showing ${rows.length} of ${meta.totalItems} ${meta.totalItems === 1 ? 'entry' : 'entries'}`
            : undefined
        }
        action={
          <label className="flex items-center gap-2 text-xs text-subtle">
            Per page
            <Select
              aria-label="Entries per page"
              className="w-20 text-xs"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </label>
        }
      >
        {entries.isLoading && !entries.data ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No entries match these filters"
            description="Try widening the date range or clearing the search, or log a new meal."
            action={
              <Link href="/log">
                <Button variant="secondary">Log a meal</Button>
              </Link>
            }
          />
        ) : (
          <>
            {/* Dimmed while a new page loads, so the table does not jump to a skeleton. */}
            <div className={entries.isLoading ? 'opacity-60 transition-opacity' : undefined}>
              <EntriesTable
                entries={rows}
                deletingId={deletingId}
                onEdit={setEditingEntry}
                onDelete={handleDelete}
              />
            </div>

            {meta && <Pagination {...meta} onPageChange={setPage} />}
          </>
        )}
      </Card>

      {editingEntry && (
        <EntryFormModal
          entry={editingEntry}
          isAiAvailable={aiStatus.data?.available ?? false}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            setRevision((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

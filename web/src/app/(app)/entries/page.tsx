'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatCalories, formatDateKey, formatGrams } from '@/lib/format';
import { Alert, Button, Card, EmptyState, Pagination, Select, Skeleton } from '@/components/ui';
import {
  defaultFilters,
  EntriesFilters,
  type EntryFilterState,
} from '@/components/entries/EntriesFilters';
import { EntriesTable } from '@/components/entries/EntriesTable';
import { EntryFormModal } from '@/components/entries/EntryFormModal';
import { useDataRevision } from '@/lib/data-sync';
import type { FoodEntry } from '@/lib/types';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function EntriesPage() {
  const [filters, setFilters] = useState<EntryFilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const dataRevision = useDataRevision();

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
      dataRevision,
    ],
  );

  const rows = entries.data?.data ?? [];
  const meta = entries.data?.meta;
  const totals = entries.data?.totals;

  /**
   * Deleting the last row of the last page leaves the current page beyond the
   * end of the results: an empty list, and no pager to escape with because the
   * pager only renders alongside rows.
   */
  const isPastLastPage = Boolean(meta && meta.totalPages > 0 && page > meta.totalPages);

  /**
   * Any filter change returns to page one: staying on page 4 of a result set
   * that now has two pages would show an empty list for no obvious reason.
   */
  function applyFilters(next: EntryFilterState) {
    setFilters(next);
    setPage(1);
    setNotice(null);
  }

  async function handleDelete(entry: FoodEntry) {
    if (!window.confirm(`Delete "${entry.foodName}"?`)) {
      return;
    }

    setActionError(null);
    setNotice(null);
    setDeletingId(entry.id);

    try {
      await api.entries.remove(entry.id);

      // Removing the only row on this page would otherwise leave it empty.
      if (rows.length === 1 && page > 1) {
        setPage(page - 1);
      }

      setRevision((value) => value + 1);
      setNotice(`Deleted "${entry.foodName}".`);
    } catch (caught) {
      setActionError(errorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  /**
   * An edit can move an entry out of the active filters, so it disappears from
   * the list. Saying so explicitly stops that looking like a failed save.
   */
  function handleSaved(saved: FoodEntry) {
    setEditingEntry(null);
    setRevision((value) => value + 1);

    const movedOutOfRange =
      (filters.from && saved.consumedOn < filters.from) ||
      (filters.to && saved.consumedOn > filters.to) ||
      (filters.mealType && saved.mealType !== filters.mealType);

    setNotice(
      movedOutOfRange
        ? `Saved "${saved.foodName}" to ${formatDateKey(saved.consumedOn)}. It no longer matches your filters, so it has left this list.`
        : `Saved "${saved.foodName}".`,
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Diary</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Entries</h1>
          <p className="mt-1 text-sm text-muted">Everything you&apos;ve logged, searchable and filterable.</p>
        </div>
        <Link href="/log">
          <Button>+ Log a meal</Button>
        </Link>
      </header>

      <Card className="rounded-2xl">
        <EntriesFilters value={filters} onChange={applyFilters} />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryTile label="Entries" value={(meta?.totalItems ?? 0).toLocaleString()} />
        <SummaryTile
          label="Calories"
          value={`${formatCalories(totals?.calories ?? 0)} kcal`}
        />
        <SummaryTile label="Protein (g)" value={formatGrams(totals?.proteinGrams ?? 0)} />
        <SummaryTile label="Carbs (g)" value={formatGrams(totals?.carbGrams ?? 0)} />
        <SummaryTile label="Fat (g)" value={formatGrams(totals?.fatGrams ?? 0)} />
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {entries.error && <Alert>{entries.error}</Alert>}
      {notice && !actionError && <Alert tone="info">{notice}</Alert>}

      <Card
        className="rounded-2xl"
        title={
          filters.from && filters.to
            ? filters.from === filters.to
              ? formatDateKey(filters.from, 'd MMMM yyyy')
              : `${formatDateKey(filters.from, 'd MMM')} – ${formatDateKey(filters.to, 'd MMM yyyy')}`
            : 'All entries'
        }
        description={
          meta
            ? `${meta.totalItems} ${meta.totalItems === 1 ? 'result' : 'results'}`
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
        ) : isPastLastPage ? (
          <EmptyState
            title="No entries on this page"
            description={`These filters only reach page ${meta?.totalPages}.`}
            action={
              <Button variant="secondary" onClick={() => setPage(meta?.totalPages ?? 1)}>
                Go to the last page
              </Button>
            }
          />
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
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

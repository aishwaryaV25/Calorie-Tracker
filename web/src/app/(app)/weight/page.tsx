'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage, useAuth } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatDateKey, todayKey } from '@/lib/format';
import { openBite } from '@/lib/open-bite';
import { Alert, Button, EmptyState, Pagination, Skeleton } from '@/components/ui';
import { WeightChart } from '@/components/weight/WeightChart';
import { WeightComposer } from '@/components/weight/WeightComposer';
import { WeightHistory } from '@/components/weight/WeightHistory';
import { formatKg } from '@/components/weight/formatKg';

const HISTORY_PAGE_SIZE = 10;
const CHART_PAGE_SIZE = 30;

export default function WeightPage() {
  const today = todayKey();
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';

  const [historyPage, setHistoryPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = useAsync(() => api.weights.current(), [revision]);
  const goal = useAsync(() => api.goals.current(today), [today, revision]);
  const chart = useAsync(
    () => api.weights.list({ page: 1, pageSize: CHART_PAGE_SIZE }),
    [revision],
  );
  const history = useAsync(
    () => api.weights.list({ page: historyPage, pageSize: HISTORY_PAGE_SIZE }),
    [historyPage, revision],
  );

  const latest = current.data?.weight ?? null;
  const previous = chart.data?.data[1] ?? null;
  const targetKg = goal.data?.goal?.targetWeightKg ?? null;
  const delta = latest && previous ? latest.kg - previous.kg : null;
  const gap = latest && targetKg != null ? latest.kg - targetKg : null;

  function refreshAll() {
    setHistoryPage(1);
    setRevision((value) => value + 1);
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    setDeletingId(id);

    try {
      await api.weights.remove(id);
      setNotice('That weigh-in was deleted.');
      refreshAll();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Nutrition</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Weight Tracker</h1>
          <p className="mt-1 text-sm text-muted">The scale is a log, not a verdict.</p>
          <button
            type="button"
            onClick={openBite}
            className="mt-2 text-left text-sm text-accent hover:text-accent-hover"
          >
            Ask Bite about gym workouts, weight management and more.
          </button>
        </div>
        <Button variant="secondary" onClick={openBite} className="hidden sm:inline-flex">
          Ask Bite
        </Button>
      </header>

      {notice && !deleteError && <Alert tone="info">{notice}</Alert>}
      {current.error && <Alert>{current.error}</Alert>}

      <section className="overflow-hidden rounded-[1.75rem] bg-foreground text-white shadow-[0_20px_50px_rgb(17_17_19/0.18)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3 sm:px-7">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">On the scale</p>
          <p className="text-xs text-white/40">
            {latest
              ? `Last mark ${formatDateKey(latest.loggedOn, 'd MMM yyyy')}`
              : firstName
                ? `${firstName}, step on it.`
                : 'Step on it.'}
          </p>
        </div>

        <div className="grid gap-8 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] lg:items-end">
          <div>
            {current.isLoading && !current.data ? (
              <Skeleton className="h-24 w-64 bg-white/10" />
            ) : (
              <WeightComposer
                key={`${latest?.id ?? 'new'}-${latest?.kg ?? 0}`}
                latest={latest}
                onSaved={(saved) => {
                  setNotice(`Saved ${formatKg(saved.kg)} kg for that day.`);
                  refreshAll();
                }}
              />
            )}
          </div>

          <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-1">
            <Ticker
              label="Since last"
              value={
                delta == null
                  ? '—'
                  : Math.abs(delta) < 0.05
                    ? 'Held'
                    : `${formatKg(Math.abs(delta))} kg ${delta < 0 ? 'down' : 'up'}`
              }
            />
            <Ticker
              label="Goal"
              value={
                targetKg == null
                  ? 'Set it on Goals'
                  : gap == null
                    ? `${formatKg(targetKg)} kg`
                    : Math.abs(gap) < 0.05
                      ? 'On the mark'
                      : gap > 0
                        ? `${formatKg(gap)} kg above`
                        : `${formatKg(-gap)} kg to go`
              }
            />
          </dl>
        </div>

        <div className="border-t border-white/10 px-3 py-4 sm:px-5">
          {chart.error && (
            <div className="px-2 pb-3">
              <Alert>{chart.error}</Alert>
            </div>
          )}
          {chart.isLoading && !chart.data ? (
            <Skeleton className="mx-2 h-48 bg-white/10" />
          ) : (
            <WeightChart readings={chart.data?.data ?? []} targetKg={targetKg} />
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Tape</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Readings</h2>
          </div>
          {history.data && history.data.meta.totalItems > 0 && (
            <span className="text-xs text-subtle">
              {history.data.meta.totalItems}{' '}
              {history.data.meta.totalItems === 1 ? 'mark' : 'marks'}
            </span>
          )}
        </div>

        {deleteError && <Alert>{deleteError}</Alert>}
        {history.error && <Alert>{history.error}</Alert>}

        {history.isLoading && !history.data ? (
          <Skeleton className="h-28 w-full" />
        ) : !history.data || history.data.data.length === 0 ? (
          <EmptyState
            title="The tape is blank"
            description="Type a number on the scale and save. Bite reads this list for gym talk."
          />
        ) : (
          <>
            <WeightHistory
              readings={history.data.data}
              latestId={latest?.id ?? null}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
            <Pagination {...history.data.meta} onPageChange={setHistoryPage} />
          </>
        )}
      </section>
    </div>
  );
}

function Ticker({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-white/35">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums text-white/85">{value}</dd>
    </div>
  );
}

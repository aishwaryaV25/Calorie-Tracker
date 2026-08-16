'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage, useAuth } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatDateKey, todayKey } from '@/lib/format';
import { Alert, EmptyState, Pagination, Skeleton } from '@/components/ui';
import { GoalComposer } from '@/components/goals/GoalComposer';
import { GoalHistory } from '@/components/goals/GoalHistory';
import { GoalProgress } from '@/components/goals/GoalProgress';
import { GoalsHero } from '@/components/goals/GoalsHero';
import { useGoalsMotion } from '@/components/goals/useGoalsMotion';
import { useDataRevision } from '@/lib/data-sync';

const HISTORY_PAGE_SIZE = 5;

export default function GoalsPage() {
  const today = todayKey();
  const dataRevision = useDataRevision();
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';
  const rootRef = useRef<HTMLDivElement>(null);
  useGoalsMotion(rootRef);

  const [historyPage, setHistoryPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = useAsync(() => api.goals.current(today), [today, revision, dataRevision]);
  const todayTotals = useAsync(
    () => api.entries.list({ from: today, to: today, pageSize: 1 }),
    [today, revision, dataRevision],
  );
  const history = useAsync(
    () => api.goals.history({ page: historyPage, pageSize: HISTORY_PAGE_SIZE }),
    [historyPage, revision, dataRevision],
  );

  const goal = current.data?.goal ?? null;

  function refreshAll() {
    setHistoryPage(1);
    setRevision((value) => value + 1);
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    setDeletingId(id);

    try {
      await api.goals.remove(id);
      setNotice('That target version was deleted.');
      refreshAll();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-5">
      <header data-goals="head">
        <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Nutrition</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Goals</h1>
        <p className="mt-1 text-sm text-muted">The film holds the live target. The desk is where you change it.</p>
      </header>

      {notice && !deleteError && <Alert tone="info">{notice}</Alert>}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
        <GoalsHero
          firstName={firstName}
          goal={goal}
          todayCalories={todayTotals.data?.totals.calories ?? null}
        />

        {current.isLoading && !current.data ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div data-goals="compose">
            <GoalComposer
              key={goal?.id ?? 'new'}
              currentGoal={goal}
              onSaved={(saved) => {
                setNotice(`Targets saved, effective from ${formatDateKey(saved.effectiveFrom)}.`);
                refreshAll();
              }}
            />
          </div>
        )}
      </div>

      <section
        data-goals="today"
        className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
      >
        {(current.isLoading && !current.data) || (todayTotals.isLoading && !todayTotals.data) ? (
          <Skeleton className="h-12 w-full" />
        ) : !goal ? (
          <EmptyState
            title="No targets yet"
            description="Set a daily calorie and macro target to start tracking progress against it."
          />
        ) : (
          <GoalProgress
            target={goal}
            actual={
              todayTotals.data?.totals ?? {
                calories: 0,
                proteinGrams: 0,
                carbGrams: 0,
                fatGrams: 0,
              }
            }
          />
        )}
      </section>

      <section data-goals="history">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Versions</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">History</h2>
          </div>
          {history.data && history.data.meta.totalItems > 0 && (
            <span className="text-xs text-subtle">
              {history.data.meta.totalItems}{' '}
              {history.data.meta.totalItems === 1 ? 'version' : 'versions'}
            </span>
          )}
        </div>

        {deleteError && <Alert>{deleteError}</Alert>}
        {history.error && <Alert>{history.error}</Alert>}

        {history.isLoading && !history.data ? (
          <Skeleton className="h-24 w-full" />
        ) : !history.data || history.data.data.length === 0 ? (
          <EmptyState
            title="Nothing saved yet"
            description="Your goal history will build up here each time you change your targets."
          />
        ) : (
          <>
            <GoalHistory
              goals={history.data.data}
              currentGoalId={goal?.id ?? null}
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

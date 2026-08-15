'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, formatDateKey, formatGrams, todayKey } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Pagination, Skeleton } from '@/components/ui';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalProgress } from '@/components/goals/GoalProgress';
import type { Goal } from '@/lib/types';

const HISTORY_PAGE_SIZE = 5;

export default function GoalsPage() {
  const today = todayKey();
  const [historyPage, setHistoryPage] = useState(1);
  // Bumped after any save or delete so every panel on the page refetches together.
  const [revision, setRevision] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const current = useAsync(() => api.goals.current(today), [today, revision]);
  const todayTotals = useAsync(
    () => api.entries.list({ from: today, to: today, pageSize: 1 }),
    [today, revision],
  );
  const history = useAsync(
    () => api.goals.history({ page: historyPage, pageSize: HISTORY_PAGE_SIZE }),
    [historyPage, revision],
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
      refreshAll();
    } catch (caught) {
      setDeleteError(errorMessage(caught));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted">
          Set your daily targets. Saving keeps the old targets on the days they applied to, so past
          reports stay accurate.
        </p>
      </header>

      {/* The form keeps a fixed, readable width; everything to its right grows
          with the viewport, which is where the wide history table wants to live. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card
          title={goal ? 'Update your targets' : 'Set your targets'}
          description="Calories and macros for a typical day."
        >
          {current.isLoading && !current.data ? (
            <Skeleton className="h-80 w-full" />
          ) : (
            // Keyed so saving a new version resets the inputs to that version.
            <GoalForm key={goal?.id ?? 'new'} currentGoal={goal} onSaved={refreshAll} />
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Card
              title="Today against target"
              description={goal ? `In force since ${formatDateKey(goal.effectiveFrom)}` : undefined}
            >
              {(current.isLoading && !current.data) ||
              (todayTotals.isLoading && !todayTotals.data) ? (
                <Skeleton className="h-48 w-full" />
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
            </Card>

            {goal?.targetWeightKg != null && (
              <Card title="Weight goal" className="sm:w-44">
                <p className="text-2xl font-semibold tabular-nums">
                  {goal.targetWeightKg}
                  <span className="ml-1 text-sm font-normal text-subtle">kg</span>
                </p>
              </Card>
            )}
          </div>

          <Card
            title="History"
            description="Every version of your targets, newest first."
            action={
              history.data && history.data.meta.totalItems > 0 ? (
                <span className="text-xs text-subtle">
                  {history.data.meta.totalItems}{' '}
                  {history.data.meta.totalItems === 1 ? 'version' : 'versions'}
                </span>
              ) : undefined
            }
          >
            {deleteError && <Alert>{deleteError}</Alert>}
            {history.error && <Alert>{history.error}</Alert>}

            {history.isLoading && !history.data ? (
              <Skeleton className="h-32 w-full" />
            ) : !history.data || history.data.data.length === 0 ? (
              <EmptyState
                title="Nothing saved yet"
                description="Your goal history will build up here each time you change your targets."
              />
            ) : (
              <>
                <GoalHistoryList
                  goals={history.data.data}
                  currentGoalId={goal?.id ?? null}
                  deletingId={deletingId}
                  onDelete={handleDelete}
                />

                <Pagination {...history.data.meta} onPageChange={setHistoryPage} />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

interface GoalHistoryListProps {
  goals: Goal[];
  currentGoalId: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
}

/**
 * Cards on narrow screens and a table on wide ones: the same six numbers are
 * unreadable squeezed into a phone-width table.
 */
function GoalHistoryList({ goals, currentGoalId, deletingId, onDelete }: GoalHistoryListProps) {
  return (
    <>
      <ul className="flex flex-col divide-y divide-border md:hidden">
        {goals.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-1.5 py-3 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatDateKey(entry.effectiveFrom)}</span>
                {entry.id === currentGoalId && <Badge tone="accent">Active</Badge>}
              </div>
              <span className="text-sm tabular-nums">
                {formatCalories(entry.dailyCalories)} kcal
              </span>
            </div>
            <p className="text-xs text-muted">
              {formatGrams(entry.proteinGrams)}g protein · {formatGrams(entry.carbGrams)}g carbs ·{' '}
              {formatGrams(entry.fatGrams)}g fat
              {entry.targetWeightKg != null && ` · ${entry.targetWeightKg}kg goal`}
            </p>
            <Button
              variant="danger"
              className="mt-1 self-start px-2 py-1 text-xs"
              isLoading={deletingId === entry.id}
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-subtle">
              <th className="pb-2 font-medium">Effective from</th>
              <th className="pb-2 text-right font-medium">Calories</th>
              <th className="pb-2 text-right font-medium">Protein</th>
              <th className="pb-2 text-right font-medium">Carbs</th>
              <th className="pb-2 text-right font-medium">Fat</th>
              <th className="pb-2 text-right font-medium">Weight</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {goals.map((entry) => (
              <tr key={entry.id}>
                <td className="py-2.5">
                  <div className="flex items-center gap-2">
                    {formatDateKey(entry.effectiveFrom, 'd MMM yyyy')}
                    {entry.id === currentGoalId && <Badge tone="accent">Active</Badge>}
                  </div>
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatCalories(entry.dailyCalories)}
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatGrams(entry.proteinGrams)}g
                </td>
                <td className="py-2.5 text-right tabular-nums">{formatGrams(entry.carbGrams)}g</td>
                <td className="py-2.5 text-right tabular-nums">{formatGrams(entry.fatGrams)}g</td>
                <td className="py-2.5 text-right tabular-nums text-muted">
                  {entry.targetWeightKg != null ? `${entry.targetWeightKg}kg` : '—'}
                </td>
                <td className="py-2.5 text-right">
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs hover:text-danger"
                    isLoading={deletingId === entry.id}
                    onClick={() => onDelete(entry.id)}
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

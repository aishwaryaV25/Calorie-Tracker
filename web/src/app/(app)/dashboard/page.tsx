'use client';

import { useCallback, useRef, useState } from 'react';
import { BiteSpotlight } from '@/components/dashboard/BiteSpotlight';
import { useTodayMotion } from '@/components/dashboard/useTodayMotion';
import { EntryFormModal } from '@/components/entries/EntryFormModal';
import { CalorieTrendChart } from '@/components/reports/CalorieTrendChart';
import { SourceBadge } from '@/components/entries/SourceBadge';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useDataRevision } from '@/lib/data-sync';
import { daysAgoKey, formatCalories, formatGrams, todayKey } from '@/lib/format';
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type MealType } from '@/lib/types';

export default function DashboardPage() {
  const today = todayKey();
  const dataRevision = useDataRevision();
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';
  const rootRef = useRef<HTMLDivElement>(null);
  useTodayMotion(rootRef);

  const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
  const [composingMeal, setComposingMeal] = useState<MealType | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => setReloadToken((token) => token + 1), []);

  const aiStatus = useAsync(() => api.ai.status(), []);
  const goal = useAsync(() => api.goals.current(today), [today, reloadToken, dataRevision]);

  const entries = useAsync(
    () => api.entries.list({ from: today, to: today, pageSize: 100, order: 'asc' }),
    [today, reloadToken, dataRevision],
  );

  const trend = useAsync(
    () => api.reports.daily({ from: daysAgoKey(6), to: today, pageSize: 7 }),
    [today, reloadToken, dataRevision],
  );

  const isAiAvailable = aiStatus.data?.available ?? false;
  const totals = entries.data?.totals;
  const target = goal.data?.goal;
  const remaining =
    target && totals ? Math.max(0, target.dailyCalories - totals.calories) : null;

  const closeForm = () => {
    setEditingEntry(null);
    setComposingMeal(null);
  };

  const handleSaved = () => {
    closeForm();
    refresh();
  };

  async function handleDelete(entry: FoodEntry) {
    if (!window.confirm(`Delete "${entry.foodName}"?`)) {
      return;
    }
    await api.entries.remove(entry.id);
    refresh();
  }

  const weekday = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <header data-today="head" className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Today</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{weekday}</h1>
        </div>
        <Button onClick={() => setComposingMeal('breakfast')}>Add entry</Button>
      </header>

      {entries.error && <Alert>{entries.error}</Alert>}

      <BiteSpotlight firstName={firstName} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div
          data-today="stat"
          className="flex flex-col justify-between rounded-2xl border border-border bg-surface px-6 py-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
        >
          <p className="text-xs text-muted">Left in the day</p>
          {totals === undefined ? (
            <Skeleton className="mt-3 h-12 w-36" />
          ) : remaining === null ? (
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {formatCalories(totals.calories)}
              <span className="ml-2 text-base font-medium text-subtle">kcal so far</span>
            </p>
          ) : (
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
              {formatCalories(remaining)}
              <span className="ml-2 text-base font-medium text-subtle">kcal</span>
            </p>
          )}
          <p className="mt-3 text-sm text-muted">
            {target
              ? `${formatCalories(totals?.calories ?? 0)} of ${formatCalories(target.dailyCalories)} logged`
              : 'Set a goal and this number becomes what you have left.'}
          </p>
          {target && totals && (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <div
                className="h-full rounded-full bg-foreground"
                style={{
                  width: `${Math.min(100, (totals.calories / target.dailyCalories) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile
            label="Calories"
            value={totals ? formatCalories(totals.calories) : null}
            target={target ? `of ${formatCalories(target.dailyCalories)} kcal` : 'No goal set'}
            progress={target && totals ? totals.calories / target.dailyCalories : null}
            accent="var(--foreground)"
          />
          <SummaryTile
            label="Protein"
            value={totals ? `${formatGrams(totals.proteinGrams)} g` : null}
            target={target ? `of ${formatGrams(target.proteinGrams)} g` : '—'}
            progress={target && totals ? totals.proteinGrams / target.proteinGrams : null}
            accent="var(--protein)"
          />
          <SummaryTile
            label="Carbs"
            value={totals ? `${formatGrams(totals.carbGrams)} g` : null}
            target={target ? `of ${formatGrams(target.carbGrams)} g` : '—'}
            progress={target && totals ? totals.carbGrams / target.carbGrams : null}
            accent="var(--carbs)"
          />
          <SummaryTile
            label="Fat"
            value={totals ? `${formatGrams(totals.fatGrams)} g` : null}
            target={target ? `of ${formatGrams(target.fatGrams)} g` : '—'}
            progress={target && totals ? totals.fatGrams / target.fatGrams : null}
            accent="var(--fat)"
          />
        </div>
      </section>

      {!goal.isLoading && !target && (
        <Alert tone="info">
          You have not set any targets yet. Head to Goals to add a daily calorie and macro target,
          and these tiles will start comparing against it.
        </Alert>
      )}

      <section>
        <div className="mb-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">The plate</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Four meals, one day.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MEAL_TYPES.map((meal) => {
            const mealEntries = (entries.data?.data ?? []).filter((item) => item.mealType === meal);
            const mealCalories = mealEntries.reduce((sum, item) => sum + item.calories, 0);

            return (
              <article
                key={meal}
                data-today="meal"
                className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
              >
                <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
                  <div className="flex items-center gap-2.5">
                    <MealMark meal={meal} />
                    <div>
                      <p className="text-sm font-semibold">{MEAL_LABELS[meal]}</p>
                      <p className="text-xs text-subtle">
                        {formatCalories(mealCalories)} kcal
                        {mealEntries.length > 0 &&
                          ` · ${mealEntries.length} ${mealEntries.length === 1 ? 'item' : 'items'}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => setComposingMeal(meal)} className="px-2 py-1 text-xs">
                    Add
                  </Button>
                </header>
                <div className="px-5 pb-4">
                  {entries.isLoading ? (
                    <Skeleton className="h-14 w-full" />
                  ) : mealEntries.length === 0 ? (
                    <p className="border-t border-border pt-3 text-xs text-subtle">Nothing here yet.</p>
                  ) : (
                    <ul className="flex flex-col">
                      {mealEntries.map((entry) => (
                        <li key={entry.id} className="border-t border-border py-3">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-sm font-medium leading-snug">{entry.foodName}</p>
                            <p className="shrink-0 text-sm tabular-nums">
                              {formatCalories(entry.calories)}
                            </p>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <SourceBadge source={entry.source} />
                            <span className="text-xs text-subtle">
                              {entry.quantity} {entry.unit}
                            </span>
                            <span className="ml-auto flex gap-1">
                              <Button
                                variant="ghost"
                                className="px-2 py-0.5 text-xs"
                                onClick={() => setEditingEntry(entry)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-2 py-0.5 text-xs hover:text-danger"
                                onClick={() => void handleDelete(entry)}
                              >
                                Delete
                              </Button>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {entries.data?.meta.totalItems === 0 && (
        <EmptyState
          title="Nothing logged today"
          description="Add your first meal, or ask Bite what would fit the rest of the day."
          action={<Button onClick={() => setComposingMeal('breakfast')}>Add entry</Button>}
        />
      )}

      <section
        data-today="week"
        className="rounded-2xl border border-border bg-surface px-5 py-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
      >
        <p className="text-sm font-medium">Last 7 days</p>
        <p className="mt-0.5 text-xs text-muted">Calories logged per day against your target.</p>
        <div className="mt-4">
          {trend.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <CalorieTrendChart rows={[...(trend.data?.data ?? [])].reverse()} />
          )}
        </div>
      </section>

      {(composingMeal || editingEntry) && (
        <EntryFormModal
          entry={editingEntry}
          defaultMealType={composingMeal ?? 'breakfast'}
          isAiAvailable={isAiAvailable}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  target,
  progress,
  accent,
}: {
  label: string;
  value: string | null;
  target: string;
  progress: number | null;
  accent: string;
}) {
  const percentage = progress === null ? null : Math.min(Math.max(progress, 0), 1) * 100;
  const isOver = progress !== null && progress > 1;

  return (
    <div
      data-today="stat"
      className="rounded-2xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]"
    >
      <p className="text-xs text-muted">{label}</p>
      {value === null ? (
        <Skeleton className="mt-1.5 h-7 w-20" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      )}
      <p className="mt-0.5 text-xs text-subtle">{target}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        {percentage !== null && (
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${percentage}%`,
              backgroundColor: isOver ? 'var(--danger)' : accent,
            }}
          />
        )}
      </div>
    </div>
  );
}

function MealMark({ meal }: { meal: MealType }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
      <svg viewBox="0 0 20 20" className="size-4" fill="none" aria-hidden>
        {meal === 'breakfast' && (
          <circle cx="10" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.6" />
        )}
        {meal === 'lunch' && (
          <>
            <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
          </>
        )}
        {meal === 'dinner' && (
          <path
            d="M4 14.5c2-5 10-5 12 0M7 6.5h6M10 6.5v5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )}
        {meal === 'snack' && (
          <path
            d="M6 13.5c0-3 1.8-6.5 4-6.5s4 3.5 4 6.5H6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </span>
  );
}

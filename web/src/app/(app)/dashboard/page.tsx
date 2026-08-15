'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api-client';
import { useAsync } from '@/hooks/useAsync';
import { daysAgoKey, formatCalories, formatGrams, formatTime, todayKey } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { EntryFormModal } from '@/components/entries/EntryFormModal';
import { CalorieTrendChart } from '@/components/reports/CalorieTrendChart';
import { useDataRevision } from '@/lib/data-sync';
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type MealType } from '@/lib/types';

export default function DashboardPage() {
  const today = todayKey();
  const dataRevision = useDataRevision();
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Today</h1>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <Button onClick={() => setComposingMeal('breakfast')}>Add entry</Button>
      </header>

      {entries.error && <Alert>{entries.error}</Alert>}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryTile
          label="Calories"
          value={totals ? formatCalories(totals.calories) : null}
          target={target ? `of ${formatCalories(target.dailyCalories)} kcal` : 'No goal set'}
          progress={target && totals ? totals.calories / target.dailyCalories : null}
          // Ink rather than red, so red stays reserved for going over target.
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

      {!goal.isLoading && !target && (
        <Alert tone="info">
          You have not set any targets yet. Head to Goals to add a daily calorie and macro target,
          and these tiles will start comparing against it.
        </Alert>
      )}

      <Card title="Last 7 days" description="Calories logged per day against your target.">
        {trend.isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <CalorieTrendChart rows={[...(trend.data?.data ?? [])].reverse()} />
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {MEAL_TYPES.map((meal) => {
          const mealEntries = (entries.data?.data ?? []).filter((item) => item.mealType === meal);
          const mealCalories = mealEntries.reduce((sum, item) => sum + item.calories, 0);

          return (
            <Card
              key={meal}
              title={MEAL_LABELS[meal]}
              description={`${formatCalories(mealCalories)} kcal`}
              action={
                <Button variant="ghost" onClick={() => setComposingMeal(meal)} className="px-2 py-1">
                  Add
                </Button>
              }
            >
              {entries.isLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : mealEntries.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted">Nothing logged yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {mealEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm">{entry.foodName}</p>
                          {entry.source !== 'manual' && <Badge>{entry.source}</Badge>}
                        </div>
                        <p className="text-xs text-muted">
                          {entry.quantity} {entry.unit} · {formatTime(entry.consumedAt)} ·{' '}
                          {formatGrams(entry.macros.proteinGrams)}p /{' '}
                          {formatGrams(entry.macros.carbGrams)}c /{' '}
                          {formatGrams(entry.macros.fatGrams)}f
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-sm tabular-nums">
                          {formatCalories(entry.calories)}
                        </span>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs"
                          onClick={() => setEditingEntry(entry)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-2 py-1 text-xs hover:text-danger"
                          onClick={() => void handleDelete(entry)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {entries.data?.meta.totalItems === 0 && (
        <EmptyState
          title="Nothing logged today"
          description="Add your first meal, or upload a photo of a nutrition label and let the app fill in the numbers."
          action={<Button onClick={() => setComposingMeal('breakfast')}>Add entry</Button>}
        />
      )}

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
  // Bar is capped at 100% so going over target does not overflow the container;
  // the number above still shows the real figure.
  const percentage = progress === null ? null : Math.min(Math.max(progress, 0), 1) * 100;
  const isOver = progress !== null && progress > 1;

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
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

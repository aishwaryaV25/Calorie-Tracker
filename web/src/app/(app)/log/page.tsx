'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, formatGrams, formatTime, todayKey } from '@/lib/format';
import { Alert, Badge, Button, Card, Skeleton } from '@/components/ui';
import { EntryForm } from '@/components/entries/EntryForm';
import { MEAL_LABELS, type FoodEntry } from '@/lib/types';

/**
 * Dedicated page for logging meals. Unlike the dashboard dialog this stays open
 * after saving and shows what was just added, which suits entering several items
 * from one meal in a row.
 */
export default function LogMealPage() {
  const today = todayKey();
  const [justLogged, setJustLogged] = useState<FoodEntry[]>([]);

  const aiStatus = useAsync(() => api.ai.status(), []);
  const todayTotals = useAsync(
    () => api.entries.list({ from: today, to: today, pageSize: 1 }),
    [today, justLogged.length],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Log a meal</h1>
          <p className="text-sm text-muted">
            Fill in the details by hand, or upload a nutrition label and let the app read it.
          </p>
        </div>
        {todayTotals.data && (
          <p className="text-sm text-muted">
            Today so far:{' '}
            <span className="font-medium text-foreground">
              {formatCalories(todayTotals.data.totals.calories)} kcal
            </span>{' '}
            across {todayTotals.data.meta.totalItems}{' '}
            {todayTotals.data.meta.totalItems === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </header>

      {/* The form column is capped: stretching text inputs across a wide monitor
          hurts readability, while the list beside it can take the leftover space. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
        <Card>
          {aiStatus.isLoading ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <EntryForm
              isAiAvailable={aiStatus.data?.available ?? false}
              submitLabel="Log meal"
              onSaved={(entry) => setJustLogged((current) => [entry, ...current])}
            />
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title="Just logged" description="Entries added in this session.">
            {justLogged.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted">
                Nothing yet. Saved entries will appear here.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {justLogged.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm">{entry.foodName}</p>
                        {entry.source !== 'manual' && <Badge>{entry.source}</Badge>}
                      </div>
                      <p className="text-xs text-muted">
                        {MEAL_LABELS[entry.mealType]} · {formatTime(entry.consumedAt)} ·{' '}
                        {formatGrams(entry.macros.proteinGrams)}p /{' '}
                        {formatGrams(entry.macros.carbGrams)}c /{' '}
                        {formatGrams(entry.macros.fatGrams)}f
                      </p>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums">
                      {formatCalories(entry.calories)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {justLogged.length > 0 && (
            <Alert tone="info">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Saved. Keep going or review the day.</span>
                <Link href="/dashboard">
                  <Button variant="secondary" className="px-2 py-1 text-xs">
                    View today
                  </Button>
                </Link>
              </div>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}

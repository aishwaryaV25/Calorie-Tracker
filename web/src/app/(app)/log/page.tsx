'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, todayKey } from '@/lib/format';
import { Alert, Button, Skeleton } from '@/components/ui';
import { LogMealComposer } from '@/components/entries/LogMealComposer';
import type { FoodEntry } from '@/lib/types';

export default function LogMealPage() {
  const today = todayKey();
  const [justLogged, setJustLogged] = useState<FoodEntry[]>([]);

  const aiStatus = useAsync(() => api.ai.status(), []);
  const todayTotals = useAsync(
    () => api.entries.list({ from: today, to: today, pageSize: 1 }),
    [today, justLogged.length],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Log a meal</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold tracking-tight sm:text-3xl">What did you eat?</h1>
        </div>
        {todayTotals.data && (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-sm text-muted shadow-[0_1px_0_rgb(255_255_255/0.8)] backdrop-blur-md">
            <FireIcon />
            Today so far:{' '}
            <span className="font-semibold text-foreground">
              {formatCalories(todayTotals.data.totals.calories)} kcal
            </span>
          </p>
        )}
      </header>

      {aiStatus.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <LogMealComposer
          isAiAvailable={aiStatus.data?.available ?? false}
          onSaved={(entries) => setJustLogged((current) => [...entries, ...current])}
        />
      )}

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
  );
}

function FireIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 text-accent"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2s3 3.2 3 6.2c0 1.6-.7 3-1.8 4.1.4-.1.8-.2 1.3-.2 2.6 0 4.5 2 4.5 4.6C19 19.6 16 22 12 22s-7-2.4-7-5.3c0-2.2 1.2-3.8 2.4-5.1C8.8 10.1 10 8.2 10 6.2 10 4.4 12 2 12 2z" />
    </svg>
  );
}

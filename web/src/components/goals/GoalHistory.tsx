'use client';

import { Badge, Button, cx } from '@/components/ui';
import { formatCalories, formatDateKey, formatGrams } from '@/lib/format';
import type { Goal } from '@/lib/types';

export function GoalHistory({
  goals,
  currentGoalId,
  deletingId,
  onDelete,
}: {
  goals: Goal[];
  currentGoalId: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <ol className="flex gap-3 overflow-x-auto pb-1">
      {goals.map((entry) => {
        const active = entry.id === currentGoalId;

        return (
          <li
            key={entry.id}
            className={cx(
              'w-[13.5rem] shrink-0 rounded-2xl border bg-surface px-4 py-3',
              active ? 'border-foreground' : 'border-border',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">{formatDateKey(entry.effectiveFrom, 'd MMM yyyy')}</p>
              {active && <Badge tone="accent">Active</Badge>}
            </div>
            <p className="mt-2 text-sm tabular-nums">
              <span className="font-semibold">{formatCalories(entry.dailyCalories)}</span>
              <span className="text-subtle"> kcal</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {formatGrams(entry.proteinGrams)}p · {formatGrams(entry.carbGrams)}c ·{' '}
              {formatGrams(entry.fatGrams)}f
              {entry.targetWeightKg != null && ` · ${entry.targetWeightKg} kg`}
            </p>
            <Button
              variant="ghost"
              className="mt-2 px-0 py-1 text-xs hover:text-danger"
              isLoading={deletingId === entry.id}
              onClick={() => onDelete(entry.id)}
            >
              Delete
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

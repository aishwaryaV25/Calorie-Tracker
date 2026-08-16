'use client';

import { Button, cx } from '@/components/ui';
import { formatDateKey } from '@/lib/format';
import type { WeightLog } from '@/lib/types';
import { formatKg } from './formatKg';

export function WeightHistory({
  readings,
  latestId,
  deletingId,
  onDelete,
}: {
  readings: WeightLog[];
  latestId: string | null;
  deletingId: string | null;
  onDelete: (id: string) => void;
}) {
  return (
    <ol className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {readings.map((row, index) => {
        const latest = row.id === latestId;
        const next = readings[index + 1];
        const step = next ? row.kg - next.kg : null;

        return (
          <li
            key={row.id}
            className={cx(
              'relative w-[8.5rem] shrink-0 border-t-2 pt-3',
              latest ? 'border-accent' : 'border-foreground/20',
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.12em] text-subtle">
              {formatDateKey(row.loggedOn, 'd MMM')}
            </p>
            <p className={cx('mt-1 text-2xl font-semibold tabular-nums', latest && 'text-accent')}>
              {formatKg(row.kg)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {step == null
                ? 'First mark'
                : Math.abs(step) < 0.05
                  ? 'Held'
                  : `${step < 0 ? '↓' : '↑'} ${formatKg(Math.abs(step))}`}
            </p>
            {row.note && <p className="mt-1 truncate text-xs text-subtle">{row.note}</p>}
            <Button
              variant="ghost"
              className="mt-2 px-0 py-1 text-xs hover:text-danger"
              isLoading={deletingId === row.id}
              onClick={() => onDelete(row.id)}
            >
              Delete
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

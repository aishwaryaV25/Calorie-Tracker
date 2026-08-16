import { cx } from '@/components/ui';
import type { FoodEntry } from '@/lib/types';

const SOURCE: Record<
  FoodEntry['source'],
  { label: string; tone: string; dot: string }
> = {
  manual: {
    label: 'Manual',
    tone: 'bg-surface-raised text-muted',
    dot: 'bg-subtle',
  },
  image: {
    label: 'AI',
    tone: 'bg-accent-soft text-accent',
    dot: 'bg-accent',
  },
  chat: {
    label: 'Chat',
    tone: 'bg-surface text-foreground ring-1 ring-inset ring-border-strong',
    dot: 'bg-foreground',
  },
  pdf: {
    label: 'PDF',
    tone: 'bg-foreground text-on-accent',
    dot: 'bg-accent',
  },
};

export function SourceBadge({ source }: { source: FoodEntry['source'] }) {
  const meta = SOURCE[source];

  return (
    <span
      className={cx(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[10px] font-semibold tracking-[0.04em]',
        meta.tone,
      )}
    >
      <span className={cx('size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

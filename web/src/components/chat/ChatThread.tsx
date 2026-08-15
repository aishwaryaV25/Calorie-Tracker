'use client';

import { useEffect, useRef } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { cx } from '@/components/ui';
import type { ChatAction, ChatTurn } from '@/lib/types';

export interface ThreadTurn extends ChatTurn {
  id: string;
  actions?: ChatAction[];
}

interface ChatThreadProps {
  turns: ThreadTurn[];
  isThinking: boolean;
}

export function ChatThread({ turns, isThinking }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, isThinking]);

  return (
    <div className="flex flex-col gap-5">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={cx('flex gap-3', turn.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          {turn.role === 'assistant' && (
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
              <BrandMark size={18} withName={false} />
            </span>
          )}

          <div
            className={cx(
              'flex max-w-[46rem] flex-col gap-2',
              turn.role === 'user' ? 'items-end' : 'items-start',
            )}
          >
            <div
              className={cx(
                'rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                turn.role === 'user'
                  ? 'bg-accent-soft text-foreground'
                  : 'border border-border bg-surface text-foreground',
              )}
            >
              {turn.content}
            </div>

            {turn.actions && turn.actions.length > 0 && (
              <ul className="flex w-full flex-col gap-1.5">
                {turn.actions.map((action, index) => (
                  <li
                    key={`${turn.id}-${index}`}
                    className="rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-xs text-accent"
                  >
                    {action.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}

      {isThinking && (
        <div className="flex items-center gap-3" role="status">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft">
            <BrandMark size={18} withName={false} />
          </span>
          <p className="text-xs text-subtle">Thinking…</p>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

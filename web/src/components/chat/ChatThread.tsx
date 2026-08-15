'use client';

import { useEffect, useRef } from 'react';
import { cx } from '@/components/ui';
import type { ChatAction, ChatTurn } from '@/lib/types';

/**
 * A turn as the page holds it: the message, plus for an assistant turn whatever it
 * changed in the diary. The actions are kept beside the reply rather than woven
 * into its text so the record of what happened comes from the server, not from
 * the model's account of itself.
 */
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

  // Follows the conversation down as it grows, the way a messaging app does.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, isThinking]);

  return (
    <div className="flex flex-col gap-4">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={cx('flex flex-col gap-1.5', turn.role === 'user' ? 'items-end' : 'items-start')}
        >
          <div
            className={cx(
              'max-w-[46rem] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
              turn.role === 'user'
                ? 'bg-foreground text-surface'
                : 'border border-border bg-surface text-foreground',
            )}
          >
            {turn.content}
          </div>

          {turn.actions && turn.actions.length > 0 && (
            <ul className="flex max-w-[46rem] flex-col gap-1">
              {turn.actions.map((action, index) => (
                <li
                  key={`${turn.id}-${index}`}
                  className="flex items-start gap-2 rounded-lg border border-danger/25 bg-accent-soft px-3 py-1.5 text-xs text-accent"
                >
                  <span aria-hidden className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                  {action.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {isThinking && (
        <div className="flex items-center gap-2 text-xs text-subtle" role="status">
          <span
            aria-hidden
            className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Thinking…
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

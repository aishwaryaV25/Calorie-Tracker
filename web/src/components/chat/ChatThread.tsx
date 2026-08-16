'use client';

import { useEffect, useRef } from 'react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Button, cx } from '@/components/ui';
import { saveChatDownload } from '@/lib/download-file';
import type { ChatAction, ChatDownload, ChatPendingAction, ChatTurn } from '@/lib/types';

export interface ThreadTurn extends ChatTurn {
  id: string;
  actions?: ChatAction[];
  pendingAction?: ChatPendingAction | null;
  download?: ChatDownload;
}

interface ChatThreadProps {
  turns: ThreadTurn[];
  isThinking: boolean;
  onChoose?: (entryId: string) => void;
  onConfirm?: (confirm: boolean) => void;
}

export function ChatThread({ turns, isThinking, onChoose, onConfirm }: ChatThreadProps) {
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
              'flex min-w-0 max-w-full flex-col gap-2 sm:max-w-[46rem]',
              turn.role === 'user' ? 'items-end' : 'items-start',
            )}
          >
            <AssistantOrUserBody turn={turn} />

            {turn.actions && turn.actions.length > 0 && (
              <ul className="flex w-full flex-col gap-1.5">
                {turn.actions.map((action, index) => (
                  <li
                    key={`${turn.id}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent-soft px-3 py-2 text-xs text-accent"
                  >
                    <span>{action.label}</span>
                    {action.type === 'report_ready' && turn.download && (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-accent hover:text-accent-hover"
                        onClick={() => saveChatDownload(turn.download!)}
                      >
                        Save PDF
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {turn.pendingAction && turn.pendingAction.kind === 'confirm_bulk_delete' && onConfirm && (
              <div className="flex gap-2">
                <Button className="px-3 py-1.5 text-xs" onClick={() => onConfirm(true)}>
                  Yes, delete them
                </Button>
                <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onConfirm(false)}>
                  Keep them
                </Button>
              </div>
            )}

            {turn.pendingAction &&
              (turn.pendingAction.kind === 'confirm_extract' || turn.pendingAction.kind === 'review_import') &&
              onConfirm && (
                <div className="flex gap-2">
                  <Button className="px-3 py-1.5 text-xs" onClick={() => onConfirm(true)}>
                    {turn.pendingAction.kind === 'review_import' ? 'Log these' : 'Log it'}
                  </Button>
                  <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => onConfirm(false)}>
                    Discard
                  </Button>
                </div>
              )}

            {turn.pendingAction &&
              turn.pendingAction.kind !== 'confirm_bulk_delete' &&
              turn.pendingAction.kind !== 'confirm_extract' &&
              turn.pendingAction.kind !== 'review_import' &&
              onChoose && (
                <ul className="flex w-full flex-col gap-1.5">
                  {turn.pendingAction.candidates.map((entry) => (
                    <li key={entry.entryId}>
                      <button
                        type="button"
                        onClick={() => onChoose(entry.entryId)}
                        className="w-full rounded-xl border border-border bg-surface-raised px-3 py-2 text-left text-xs hover:border-accent hover:bg-accent-soft"
                      >
                        <span className="font-medium capitalize">{entry.mealType}</span>
                        {' · '}
                        {entry.foodName}
                        {' · '}
                        {Math.round(entry.calories)} kcal
                      </button>
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

function AssistantOrUserBody({ turn }: { turn: ThreadTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="rounded-2xl bg-foreground px-4 py-3 text-sm whitespace-pre-wrap text-on-accent">
        {turn.content}
      </div>
    );
  }

  const parts = splitDraftTable(turn.content);

  return (
    <div className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground">
      {parts.before && <p className="whitespace-pre-wrap">{parts.before}</p>}
      {parts.table && (
        <pre className="max-w-full overflow-x-auto rounded-xl bg-surface-raised px-3 py-2 font-mono text-[11px] leading-5">
          {parts.table}
        </pre>
      )}
      {parts.after && <p className="whitespace-pre-wrap">{parts.after}</p>}
    </div>
  );
}

function splitDraftTable(content: string): { before: string; table: string | null; after: string } {
  const lines = content.split('\n');
  const start = lines.findIndex((line) => line.startsWith('#') && line.includes('Meal') && line.includes('Food'));

  if (start < 0) {
    return { before: content, table: null, after: '' };
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '') {
      end = index;
      break;
    }
  }

  return {
    before: lines.slice(0, start).join('\n').trim(),
    table: lines.slice(start, end).join('\n'),
    after: lines.slice(end).join('\n').trim(),
  };
}

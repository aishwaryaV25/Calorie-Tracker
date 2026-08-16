'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { todayKey } from '@/lib/format';
import { Alert, Button, EmptyState, Skeleton } from '@/components/ui';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatThread, type ThreadTurn } from '@/components/chat/ChatThread';
import { notifyDataChanged } from '@/lib/data-sync';
import { saveChatDownload } from '@/lib/download-file';
import type { ChatPendingAction } from '@/lib/types';

const HISTORY_LIMIT = 12;

const SUGGESTIONS = [
  'I had two scrambled eggs and toast for breakfast',
  'How am I doing against my calorie goal today?',
  'Set my daily calorie target to 2200',
  'Summarise what I ate this week',
  'Generate a PDF report for last week',
];

export default function ChatPage() {
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [pendingAction, setPendingAction] = useState<ChatPendingAction | null>(null);

  const aiStatus = useAsync(() => api.ai.status(), []);

  const hasChanges = turns.some((turn) => turn.actions && turn.actions.length > 0);

  async function send(
    message: string,
    choice?: { entryId?: string; index?: number; confirm?: boolean },
    file?: File,
  ) {
    const content =
      message.trim() ||
      (file?.type === 'application/pdf'
        ? `Uploaded ${file.name}`
        : file
          ? `Uploaded a photo (${file.name})`
          : '');

    if (!content) {
      return;
    }

    const question: ThreadTurn = { id: crypto.randomUUID(), role: 'user', content };
    const history = [...turns, question];
    setTurns(history);
    setError(null);
    setIsThinking(true);

    try {
      const result = await api.ai.chat({
        messages: history.slice(-HISTORY_LIMIT).map(({ role, content: text }) => ({ role, content: text })),
        today: todayKey(),
        conversationId,
        pendingAction,
        choice,
        attachment: file,
      });

      setConversationId(result.conversationId);
      setPendingAction(result.pendingAction ?? null);
      notifyDataChanged(result.actions);
      if (result.download) {
        saveChatDownload(result.download);
      }
      setTurns([
        ...history,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.reply,
          actions: result.actions,
          pendingAction: result.pendingAction,
          download: result.download,
        },
      ]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsThinking(false);
    }
  }

  if (aiStatus.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!(aiStatus.data?.chatAvailable ?? aiStatus.data?.available)) {
    return (
      <div className="flex flex-col gap-4">
        <header>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Tools</p>
          <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight sm:text-3xl">Chat support</h1>
        </header>
        <EmptyState
          title="Chat is switched off"
          description="This server has no Gemini key configured, so the assistant cannot run. Everything it does can still be done from the other pages."
          action={
            <Link href="/log">
              <Button variant="secondary">Log a meal instead</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Tools</p>
          <h1 className="mt-1 text-[1.65rem] font-semibold tracking-tight sm:text-3xl">Chat support</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Your nutrition assistant can log meals, read a photo or PDF, make changes with your
            approval, and generate a report PDF for last week or any range you name. Nothing from
            this thread is stored.
          </p>
        </div>
        {turns.length > 0 && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Link href="/entries">
                <Button variant="secondary" className="px-3 py-1.5 text-xs">
                  See the entries
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              className="px-3 py-1.5 text-xs"
              onClick={() => {
                setTurns([]);
                setError(null);
                setConversationId(undefined);
                setPendingAction(null);
              }}
            >
              New conversation
            </Button>
          </div>
        )}
      </header>

      <section className="flex min-h-[min(68vh,calc(100dvh-14rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <p className="text-sm font-semibold">Nutrition assistant</p>
            <p className="text-xs text-subtle">Context-aware · connected to your entries and goals</p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            AI online
          </p>
        </header>

        <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:gap-5 sm:p-5">
          {turns.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center gap-6">
              <div className="rounded-2xl bg-foreground px-5 py-6 text-on-accent sm:px-6 sm:py-7">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">Ask it</p>
                <p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">What did you eat?</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/65">
                  Describe a meal, or attach a photo or a PDF diary. The assistant drafts what it
                  sees; you confirm before anything is saved.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border-strong px-3.5 py-1.5 text-left text-xs text-muted transition-colors hover:border-foreground hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <ChatThread
                turns={turns}
                isThinking={isThinking}
                onChoose={(entryId) => void send('That one', { entryId })}
                onConfirm={(confirm) => void send(confirm ? 'Yes' : 'No', { confirm })}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {error && <Alert>{error}</Alert>}
            <ChatComposer
              isBusy={isThinking}
              onSend={(message, file) => void send(message, undefined, file)}
            />
            <p className="text-xs text-subtle">
              Writes go through the same APIs as the rest of the app. A photo or PDF is drafted
              first; you confirm before it is logged. Check anything that matters on Today or
              Entries.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

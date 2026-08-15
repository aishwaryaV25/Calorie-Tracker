'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { todayKey } from '@/lib/format';
import { Alert, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { ChatThread, type ThreadTurn } from '@/components/chat/ChatThread';

/**
 * The conversational way into everything the app does: logging meals, correcting
 * them, setting goals and reading back totals, all in words.
 *
 * The transcript lives here in component state and is sent up whole on each turn,
 * because the API keeps no session. That is why a reload starts a fresh
 * conversation, and why the history sent is capped below.
 */

/**
 * How much of the conversation goes to the server. Every turn re-sends the
 * transcript, so an uncapped history would make each message dearer than the last
 * until it hit the provider's own limit. Twelve keeps several exchanges of context
 * — enough for "delete the toast" to mean something — at a predictable cost.
 */
const HISTORY_LIMIT = 12;

const SUGGESTIONS = [
  'I had two scrambled eggs and toast for breakfast',
  'How am I doing against my calorie goal today?',
  'Set my daily calorie target to 2200',
  'Summarise what I ate this week',
];

export default function ChatPage() {
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiStatus = useAsync(() => api.ai.status(), []);

  const hasChanges = turns.some((turn) => turn.actions && turn.actions.length > 0);

  async function send(message: string) {
    const question: ThreadTurn = { id: crypto.randomUUID(), role: 'user', content: message };

    // Shown immediately, and kept in the thread even if the request fails, so the
    // user can see what they asked and try again.
    const history = [...turns, question];
    setTurns(history);
    setError(null);
    setIsThinking(true);

    try {
      const { reply, actions } = await api.ai.chat({
        messages: history.slice(-HISTORY_LIMIT).map(({ role, content }) => ({ role, content })),
        today: todayKey(),
      });

      setTurns([...history, { id: crypto.randomUUID(), role: 'assistant', content: reply, actions }]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsThinking(false);
    }
  }

  if (aiStatus.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!aiStatus.data?.available) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
        <EmptyState
          title="Chat is switched off"
          description="This server has no AI key configured, so the assistant cannot run. Everything it does can still be done from the other pages."
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
          <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
          <p className="text-sm text-muted">
            Log meals, fix mistakes, set goals and ask about your intake in plain language.
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
              }}
            >
              New conversation
            </Button>
          </div>
        )}
      </header>

      <Card className="flex min-h-[60vh] flex-col justify-between gap-5">
        {turns.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <div>
              <p className="text-sm font-medium">What did you eat?</p>
              <p className="mt-1 max-w-md text-xs text-subtle">
                Describe it however you like — the assistant works out the calories, saves the
                entry and tells you what it assumed.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <ChatThread turns={turns} isThinking={isThinking} />
        )}

        <div className="flex flex-col gap-2">
          {error && <Alert>{error}</Alert>}
          <ChatComposer isBusy={isThinking} onSend={send} />
          <p className="text-xs text-subtle">
            Estimates are the assistant&apos;s best guess. Check anything that matters on the
            Entries page.
          </p>
        </div>
      </Card>
    </div>
  );
}

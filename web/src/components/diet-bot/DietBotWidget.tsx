'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage, useAuth } from '@/lib/auth-context';
import { todayKey } from '@/lib/format';
import { OPEN_BITE_EVENT } from '@/lib/open-bite';
import { cx } from '@/components/ui';
import type { ChatTurn } from '@/lib/types';

const BUTTON = 56;
const GAP = 12;
const EDGE = 12;
const DRAG_THRESHOLD = 8;
const HISTORY_LIMIT = 12;
const STORAGE_KEY = 'calorie-tracker.diet-bot-pos';

const SUGGESTIONS = [
  'What should I eat next?',
  'How do I log a meal?',
  'I am craving something salty',
  'Talk me through a high-protein day',
];

interface Position {
  x: number;
  y: number;
}

interface ThreadTurn extends ChatTurn {
  id: string;
}

function isNarrowScreen() {
  return window.innerWidth < 1024;
}

function defaultPosition(): Position {
  const dock = isNarrowScreen() ? 80 : 24;
  return {
    x: Math.max(EDGE, window.innerWidth - BUTTON - 24),
    y: Math.max(EDGE, window.innerHeight - BUTTON - dock),
  };
}

function clampPosition(pos: Position): Position {
  const dock = isNarrowScreen() ? 72 : EDGE;
  const maxX = Math.max(EDGE, window.innerWidth - BUTTON - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - BUTTON - dock);
  return {
    x: Math.min(maxX, Math.max(EDGE, pos.x)),
    y: Math.min(maxY, Math.max(EDGE, pos.y)),
  };
}

function readStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Position>;
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') {
      return null;
    }
    return clampPosition({ x: parsed.x, y: parsed.y });
  } catch {
    return null;
  }
}

export function DietBotWidget() {
  const pathname = usePathname();
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';

  const [pos, setPos] = useState<Position | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ThreadTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [narrow, setNarrow] = useState(false);

  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origin: Position;
    moved: boolean;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNarrow(isNarrowScreen());
    setPos(readStoredPosition() ?? defaultPosition());
  }, []);

  useEffect(() => {
    function onResize() {
      setNarrow(isNarrowScreen());
      setPos((current) => (current ? clampPosition(current) : current));
    }

    function onOpen() {
      setOpen(true);
    }

    window.addEventListener('resize', onResize);
    window.addEventListener(OPEN_BITE_EVENT, onOpen);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener(OPEN_BITE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api.ai.status().then((status) => {
      if (!cancelled) {
        setAvailable(status.dietBotAvailable ?? status.chatAvailable ?? status.available);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, isThinking, open]);

  const persist = useCallback((next: Position) => {
    const clamped = clampPosition(next);
    setPos(clamped);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
    return clamped;
  }, []);

  function onPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!pos) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pos,
      moved: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - session.startX;
    const dy = event.clientY - session.startY;
    if (!session.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }

    session.moved = true;
    persist({ x: session.origin.x + dx, y: session.origin.y + dy });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    drag.current = null;
    if (!session.moved) {
      setOpen((was) => !was);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || isThinking) {
      return;
    }

    const question: ThreadTurn = { id: crypto.randomUUID(), role: 'user', content };
    const history = [...turns, question];
    setTurns(history);
    setDraft('');
    setError(null);
    setIsThinking(true);

    try {
      const result = await api.ai.dietBot({
        messages: history.slice(-HISTORY_LIMIT).map(({ role, content: body }) => ({ role, content: body })),
        today: todayKey(),
        conversationId,
        page: pathname,
      });
      setConversationId(result.conversationId);
      setTurns([
        ...history,
        { id: crypto.randomUUID(), role: 'assistant', content: result.reply },
      ]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsThinking(false);
    }
  }

  if (!pos) {
    return null;
  }

  const panelWidth = Math.min(360, window.innerWidth - EDGE * 2);
  const panelHeight = Math.min(520, window.innerHeight - BUTTON - EDGE * 3);
  const openUp = pos.y >= panelHeight + GAP + EDGE || pos.y > window.innerHeight - pos.y - BUTTON;
  const panelLeft = Math.min(
    Math.max(EDGE, pos.x + BUTTON - panelWidth),
    window.innerWidth - panelWidth - EDGE,
  );
  const panelTop = openUp ? pos.y - GAP - panelHeight : pos.y + BUTTON + GAP;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {open && narrow && (
        <button
          type="button"
          aria-label="Close Bite"
          className="pointer-events-auto absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Bite, your diet buddy"
          className={cx(
            'pointer-events-auto flex flex-col overflow-hidden border-border bg-surface',
            narrow
              ? 'absolute inset-x-0 bottom-0 max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-bottom)))] rounded-t-3xl border-t shadow-[0_-16px_40px_rgb(17_17_19/0.16)]'
              : 'absolute rounded-2xl border shadow-[0_16px_40px_rgb(17_17_19/0.16)]',
          )}
          style={
            narrow
              ? { height: 'min(88dvh, 36rem)' }
              : { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight }
          }
        >
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">Bite</p>
              <p className="text-xs text-subtle">Diet buddy · always around</p>
            </div>
            <div className="flex items-center gap-1">
              {turns.length > 0 && (
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-raised hover:text-foreground"
                  onClick={() => {
                    setTurns([]);
                    setError(null);
                    setConversationId(undefined);
                  }}
                >
                  New
                </button>
              )}
              <button
                type="button"
                aria-label="Close Bite"
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {available === false ? (
                <p className="text-sm text-muted">
                  Bite is offline on this server — no Gemini key. Chat Support and the rest of the
                  app still work.
                </p>
              ) : turns.length === 0 ? (
                <div className="flex h-full flex-col justify-center gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {firstName ? `Hey ${firstName} — I'm Bite.` : "Hey — I'm Bite."}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-subtle">
                      What to eat, how this app works, or just talk. I can see today&apos;s diary. I
                      will not change it.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={isThinking}
                        onClick={() => void send(suggestion)}
                        className="rounded-full border border-border-strong bg-surface px-2.5 py-1 text-left text-xs text-muted hover:border-accent hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={cx('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <p
                        className={cx(
                          'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-5',
                          turn.role === 'user'
                            ? 'rounded-br-md bg-accent text-on-accent'
                            : 'rounded-bl-md bg-surface-raised text-foreground',
                        )}
                      >
                        {turn.content}
                      </p>
                    </div>
                  ))}
                  {isThinking && (
                    <div className="flex justify-start">
                      <p className="rounded-2xl rounded-bl-md bg-surface-raised px-3 py-2 text-sm text-subtle">
                        <span className="inline-flex gap-1">
                          <Dot delay="0ms" />
                          <Dot delay="120ms" />
                          <Dot delay="240ms" />
                        </span>
                      </p>
                    </div>
                  )}
                  <div ref={threadEndRef} />
                </div>
              )}
            </div>

            <form
              className={cx('border-t border-border p-3', narrow && 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]')}
              onSubmit={(event) => {
                event.preventDefault();
                void send(draft);
              }}
            >
              {error && <p className="mb-2 text-xs text-accent">{error}</p>}
              <div className="flex items-end gap-1.5 rounded-2xl border border-border-strong bg-background px-2 py-1.5 focus-within:border-accent">
                <label htmlFor="diet-bot-message" className="sr-only">
                  Message Bite
                </label>
                <textarea
                  id="diet-bot-message"
                  ref={inputRef}
                  rows={1}
                  maxLength={2_000}
                  value={draft}
                  disabled={available === false || isThinking}
                  placeholder="Ask Bite anything…"
                  onChange={(event) => {
                    setDraft(event.target.value);
                    const field = event.currentTarget;
                    field.style.height = 'auto';
                    field.style.height = `${Math.min(field.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send(draft);
                    }
                  }}
                  className="max-h-24 min-h-8 w-full resize-none bg-transparent py-1.5 text-sm leading-5 text-foreground placeholder:text-subtle focus:outline-none focus-visible:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || isThinking || available === false}
                  aria-label="Send"
                  className="mb-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isThinking ? <Spinner /> : <SendIcon />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-label={open ? 'Close Bite' : 'Open Bite, your diet buddy'}
        aria-expanded={open}
        hidden={open && narrow}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
        }}
        className={cx(
          'pointer-events-auto absolute flex size-14 touch-none items-center justify-center rounded-full bg-accent text-on-accent',
          'shadow-[0_8px_24px_rgb(255_34_63/0.35)] transition-transform hover:bg-accent-hover',
          'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          drag.current?.moved ? 'scale-105 cursor-grabbing' : 'cursor-grab',
        )}
        style={{ left: pos.x, top: pos.y }}
      >
        <BiteIcon />
      </button>
    </div>
  );
}

function BiteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <path
        d="M5 11.5c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5-3.1 6.5-7 6.5c-.7 0-1.4-.1-2-.3L6 19l.8-2.6C5.7 15.4 5 13.6 5 11.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="11.2" r="1" fill="currentColor" />
      <circle cx="12" cy="11.2" r="1" fill="currentColor" />
      <circle cx="14.8" cy="11.2" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-subtle"
      style={{ animationDelay: delay }}
    />
  );
}

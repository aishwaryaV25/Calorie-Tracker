'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui';

interface ChatComposerProps {
  isBusy: boolean;
  onSend: (message: string) => void;
}

/** Matches the server's per-message limit, so an over-long message is caught here. */
const MAX_LENGTH = 2_000;

export function ChatComposer({ isBusy, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();

    if (!message || isBusy) {
      return;
    }

    setDraft('');
    onSend(message);
    // Keeps focus in the box so a follow-up can be typed straight away.
    inputRef.current?.focus();
  }

  // Enter sends and Shift+Enter makes a new line, as in any chat client.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label htmlFor="chat-message" className="sr-only">
        Message
      </label>
      <textarea
        id="chat-message"
        ref={inputRef}
        rows={2}
        value={draft}
        maxLength={MAX_LENGTH}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Tell me what you ate, or ask about your day…"
        className="min-h-[3.25rem] w-full resize-y rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-subtle focus:border-accent"
      />
      <Button type="submit" isLoading={isBusy} disabled={draft.trim().length === 0} className="h-[3.25rem] px-5">
        Send
      </Button>
    </form>
  );
}

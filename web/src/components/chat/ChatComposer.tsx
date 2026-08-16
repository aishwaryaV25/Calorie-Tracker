'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { cx } from '@/components/ui';

interface ChatComposerProps {
  isBusy: boolean;
  onSend: (message: string, file?: File) => void;
}

const MAX_LENGTH = 2_000;
const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export function ChatComposer({ isBusy, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = Boolean(draft.trim() || file);

  function resize() {
    const field = inputRef.current;
    if (!field) {
      return;
    }

    field.style.height = 'auto';
    field.style.height = `${Math.min(field.scrollHeight, 160)}px`;
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();

    if (!canSend || isBusy) {
      return;
    }

    setDraft('');
    setFile(null);
    if (fileRef.current) {
      fileRef.current.value = '';
    }
    onSend(message, file ?? undefined);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
        inputRef.current.focus();
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={submit}>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
        }}
      />

      <div className="rounded-[1.75rem] border border-border-strong bg-surface px-2 py-2 shadow-[0_1px_2px_rgb(17_17_19/0.04)] focus-within:border-accent">
        {file && (
          <div className="mb-1.5 flex items-center gap-2 rounded-2xl bg-surface-raised px-3 py-1.5 text-xs">
            <p className="min-w-0 flex-1 truncate text-muted">
              {file.type === 'application/pdf' ? 'PDF' : 'Photo'} · {file.name}
            </p>
            <button
              type="button"
              className="shrink-0 text-subtle hover:text-foreground"
              onClick={() => {
                setFile(null);
                if (fileRef.current) {
                  fileRef.current.value = '';
                }
              }}
            >
              Remove
            </button>
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <button
            type="button"
            disabled={isBusy}
            aria-label="Attach a photo or PDF"
            onClick={() => fileRef.current?.click()}
            className="mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon />
          </button>

          <label htmlFor="chat-message" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(event) => {
              setDraft(event.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            placeholder={file ? 'Add a note, or send the file as it is…' : 'Ask anything about your nutrition…'}
            className="max-h-40 min-h-9 w-full resize-none bg-transparent py-2 text-sm leading-5 text-foreground placeholder:text-subtle focus:outline-none focus-visible:outline-none"
          />

          <button
            type="submit"
            disabled={!canSend || isBusy}
            aria-label="Send"
            className={cx(
              'mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-hover',
              'focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            {isBusy ? <Spinner /> : <SendIcon />}
          </button>
        </div>
      </div>
    </form>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

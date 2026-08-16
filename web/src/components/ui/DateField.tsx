'use client';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDateKey, todayKey } from '@/lib/format';
import { cx } from './cx';

function parseKey(value: string): Date {
  return parseISO(`${value || todayKey()}T00:00:00`);
}

export function DateField({
  id,
  value,
  onChange,
  hasError,
  className,
  disabled,
  quiet,
  tone = 'paper',
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
  className?: string;
  disabled?: boolean;
  quiet?: boolean;
  tone?: 'paper' | 'ink';
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseKey(value));
  const rootRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const buttonId = id ?? generatedId;

  useEffect(() => {
    if (value) {
      setCursor(parseKey(value));
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });
  const today = todayKey();
  const selected = value || '';

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={hasError || undefined}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-md text-left text-sm transition-colors',
          tone === 'ink'
            ? 'border bg-white/8 px-3 py-2 text-white hover:bg-white/12'
            : quiet
              ? 'border border-transparent bg-transparent px-2 py-1.5 hover:bg-surface-raised'
              : 'border bg-surface px-3 py-2',
          tone === 'ink'
            ? hasError
              ? 'border-danger'
              : 'border-white/20 focus:border-accent'
            : !quiet && (hasError ? 'border-danger' : 'border-border-strong focus:border-accent'),
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <span
          className={
            tone === 'ink'
              ? value
                ? 'text-white'
                : 'text-white/40'
              : value
                ? 'text-foreground'
                : 'text-subtle'
          }
        >
          {value ? formatDateKey(value, 'd MMM yyyy') : 'Pick a date'}
        </span>
        <CalendarMark />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="absolute z-40 mt-1 w-[min(17.5rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-3 shadow-[0_12px_32px_rgb(17_17_19/0.12)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground"
              onClick={() => setCursor((current) => addMonths(current, -1))}
              aria-label="Previous month"
            >
              <NavChevron flip />
            </button>
            <p className="text-sm font-semibold">{format(cursor, 'MMMM yyyy')}</p>
            <button
              type="button"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-raised hover:text-foreground"
              onClick={() => setCursor((current) => addMonths(current, 1))}
              aria-label="Next month"
            >
              <NavChevron />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-subtle">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, cursor);
              const isSelected = selected === key;
              const isToday = today === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={cx(
                    'grid aspect-square place-items-center rounded-lg text-sm tabular-nums transition-colors',
                    !inMonth && 'text-subtle/50',
                    inMonth && !isSelected && 'text-foreground hover:bg-surface-raised',
                    isToday && !isSelected && 'text-accent',
                    isSelected && 'bg-foreground font-semibold text-surface',
                    isToday && isSelected && 'bg-accent text-on-accent',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-accent hover:bg-accent-soft"
            onClick={() => {
              onChange(today);
              setCursor(parseKey(today));
              setOpen(false);
            }}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}

export function DateTimeField({
  id,
  value,
  onChange,
  hasError,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}) {
  const [date = '', time = ''] = value.split('T');

  return (
    <div className="grid grid-cols-[1fr_6.5rem] gap-2">
      <DateField
        id={id}
        value={date}
        hasError={hasError}
        onChange={(next) => onChange(time ? `${next}T${time}` : `${next}T00:00`)}
      />
      <input
        type="time"
        aria-label="Time"
        value={time}
        onChange={(event) => onChange(date ? `${date}T${event.target.value}` : event.target.value)}
        className={cx(
          'rounded-lg border bg-surface px-2 py-2 text-sm tabular-nums',
          hasError ? 'border-danger' : 'border-border-strong focus:border-accent',
        )}
      />
    </div>
  );
}

function CalendarMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-subtle" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M5.5 2.5v2M10.5 2.5v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function NavChevron({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={cx('size-3.5', flip && 'rotate-180')} fill="none" aria-hidden>
      <path
        d="M6 3.5 11 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

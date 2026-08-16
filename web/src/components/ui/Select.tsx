'use client';

import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cx } from './cx';

type Option = { value: string; label: string; disabled?: boolean };

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) {
      return [];
    }
    if (child.type !== 'option') {
      return [];
    }
    return [
      {
        value: String(child.props.value ?? ''),
        label: String(child.props.children ?? ''),
        disabled: Boolean(child.props.disabled),
      },
    ];
  });
}

export function Select({
  id,
  value,
  onChange,
  children,
  className,
  hasError,
  disabled,
  'aria-label': ariaLabel,
  name,
  quiet,
}: SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean; quiet?: boolean }) {
  const options = readOptions(children);
  const selected = options.find((option) => option.value === String(value ?? '')) ?? options[0];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const generatedId = useId();
  const buttonId = id ?? generatedId;

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
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

  function pick(next: string) {
    onChange?.({ target: { value: next, name: name ?? '' } } as never);
    setOpen(false);
  }

  function onButtonKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={rootRef} className={cx('relative', className?.includes('w-') ? undefined : 'w-full')}>
      <button
        id={buttonId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onButtonKey}
        className={cx(
          'flex w-full items-center justify-between gap-2 rounded-md text-left text-sm transition-colors',
          quiet
            ? 'border border-transparent bg-transparent px-2 py-1.5 hover:bg-surface-raised'
            : 'border bg-surface px-3 py-2',
          !quiet && (hasError ? 'border-danger' : 'border-border-strong focus:border-accent'),
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <span className={cx('truncate', selected?.value === '' && 'text-subtle')}>
          {selected?.label || 'Select'}
        </span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute z-40 mt-1 max-h-56 w-full min-w-[8rem] overflow-auto rounded-xl border border-border bg-surface py-1 shadow-[0_12px_32px_rgb(17_17_19/0.12)]"
        >
          {options.map((option) => {
            const active = option.value === String(value ?? '');

            return (
              <li key={option.value || 'empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={option.disabled}
                  onClick={() => pick(option.value)}
                  className={cx(
                    'flex w-full px-3 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-foreground text-surface'
                      : 'text-foreground hover:bg-surface-raised',
                    option.disabled && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cx('size-3.5 shrink-0 text-subtle transition-transform', open && 'rotate-180')}
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6.5 8 10.5 12 6.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

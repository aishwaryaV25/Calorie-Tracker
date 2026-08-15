'use client';

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/** Joins class names, dropping falsy values. */
export const cx = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover font-medium',
  secondary: 'bg-surface text-foreground hover:bg-surface-raised border border-border-strong',
  ghost: 'text-muted hover:text-foreground hover:bg-surface-raised',
  danger: 'bg-transparent text-danger hover:bg-accent-soft border border-danger/30',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_STYLES[variant],
        className,
      )}
    >
      {isLoading && (
        <span
          aria-hidden
          className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required && (
          <span className="text-accent" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-subtle">{hint}</p>}
      {/* Announced to screen readers when validation fails after a submit. */}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL_STYLES =
  'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground placeholder:text-subtle transition-colors focus:border-accent';

export function Input({
  className,
  hasError,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={hasError || undefined}
      className={cx(CONTROL_STYLES, hasError && 'border-danger', className)}
    />
  );
}

export function Textarea({
  className,
  hasError,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={hasError || undefined}
      className={cx(CONTROL_STYLES, 'min-h-20 resize-y', hasError && 'border-danger', className)}
    />
  );
}

export function Select({
  className,
  hasError,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={hasError || undefined}
      className={cx(CONTROL_STYLES, hasError && 'border-danger', className)}
    >
      {children}
    </select>
  );
}

export function Card({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cx(
        'rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'warning' | 'info'; children: ReactNode }) {
  const tones = {
    error: 'border-danger/30 bg-accent-soft text-danger',
    warning: 'border-foreground/15 bg-surface-raised text-foreground',
    info: 'border-border bg-surface-raised text-muted',
  };

  return (
    <div role="alert" className={cx('rounded-lg border px-3 py-2 text-sm', tones[tone])}>
      {children}
    </div>
  );
}

/** Placeholder shown while a section loads, sized to avoid layout shift. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-surface-raised', className)} />;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-subtle">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Page stepper shared by every paginated list. Props mirror the API's `meta`
 * object field for field, so callers can spread it straight in.
 */
export function Pagination({
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button
        variant="secondary"
        className="px-3 py-1 text-xs"
        disabled={!hasPreviousPage}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-xs text-subtle">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        className="px-3 py-1 text-xs"
        disabled={!hasNextPage}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={cx(
        'rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-surface-raised text-muted',
      )}
    >
      {children}
    </span>
  );
}

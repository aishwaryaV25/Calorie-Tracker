'use client';

/**
 * Last-resort boundary for an error thrown in the root layout, where the normal
 * chrome is not available. It replaces the whole document, so it renders its own
 * `<html>` and `<body>` and depends on nothing but the stylesheet — anything
 * that could itself fail has no place in the page that reports a failure.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-6 text-foreground antialiased">
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          <span className="grid size-9 place-items-center rounded-lg bg-accent text-base font-bold text-on-accent">
            C
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-muted">
            The app hit an unexpected error and could not carry on. Your saved entries are
            unaffected.
          </p>
          {/* The digest is the only handle on the server-side log for this error. */}
          {error.digest && <p className="text-xs text-subtle">Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

'use client';

import type { RefObject } from 'react';
import { Badge, Button, cx } from '@/components/ui';

const ACCEPT = 'application/pdf';

const STEPS = [
  { n: '01', label: 'Upload' },
  { n: '02', label: 'Extract' },
  { n: '03', label: 'Review' },
  { n: '04', label: 'Import' },
] as const;

export function ImportDrop({
  inputRef,
  isParsing,
  onFile,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  isParsing: boolean;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgb(17_17_19/0.04)] lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
      <aside className="relative min-h-[16rem] bg-foreground px-6 py-7 text-on-accent">
        <div className="absolute inset-0 bg-accent/10 mix-blend-multiply" />
        <div className="relative z-10 flex h-full flex-col justify-between gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">A week of rows</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Drop the diary. Check the rows. Commit.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              A food diary, a nutrition report, or a week of meals. The script maps it first. You
              edit anything that looks off.
            </p>
          </div>
          <ol className="grid grid-cols-4 gap-2">
            {STEPS.map((step) => (
              <li key={step.n}>
                <p className="text-[10px] tabular-nums text-accent">{step.n}</p>
                <p className="mt-0.5 text-xs text-white/80">{step.label}</p>
              </li>
            ))}
          </ol>
        </div>
      </aside>

      <label
        htmlFor="bulk-import-file"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFile(event.dataTransfer.files[0] ?? null);
        }}
        className={cx(
          'flex min-h-[16rem] cursor-pointer flex-col items-center justify-center gap-4 px-6 py-10 text-center',
          isParsing && 'pointer-events-none opacity-70',
        )}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
          <PdfMark />
        </span>
        <div>
          <p className="text-base font-semibold tracking-tight">
            {isParsing ? 'Reading the diary…' : 'Drop your PDF here'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {isParsing ? 'A local script fills the table first.' : 'or click to browse · PDF up to 10 MB'}
          </p>
        </div>
        <input
          id="bulk-import-file"
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

export function ImportFileRail({
  fileName,
  isParsing,
  method,
  summary,
  deepAvailable,
  onDeepAnalyse,
  onReset,
}: {
  fileName: string;
  isParsing: boolean;
  method: 'script' | 'gemini' | null;
  summary: string;
  deepAvailable: boolean;
  onDeepAnalyse: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-5 py-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{fileName}</p>
          <Badge tone={method === 'gemini' ? 'accent' : 'neutral'}>
            {isParsing ? 'Working' : method === 'gemini' ? 'Gemini' : 'Script'}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{summary}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {deepAvailable && (
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={onDeepAnalyse}
            isLoading={isParsing}
            disabled={isParsing}
          >
            Deep analyse
          </Button>
        )}
        <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={onReset}>
          Start over
        </Button>
      </div>
    </div>
  );
}

function PdfMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M14 3v6h6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

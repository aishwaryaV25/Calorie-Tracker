'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { todayKey } from '@/lib/format';
import { Alert, Button, DateField } from '@/components/ui';
import type { WeightLog } from '@/lib/types';

export function WeightComposer({
  latest,
  onSaved,
}: {
  latest: WeightLog | null;
  onSaved: (weight: WeightLog) => void;
}) {
  const [kg, setKg] = useState(latest ? String(latest.kg) : '');
  const [loggedOn, setLoggedOn] = useState(todayKey());
  const [note, setNote] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;
  const replacesToday = latest?.loggedOn === loggedOn;

  function nudge(delta: number) {
    const current = Number(kg);
    const next = (Number.isFinite(current) ? current : 0) + delta;
    const clamped = Math.min(500, Math.max(0.1, Math.round(next * 10) / 10));
    setKg(String(clamped));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const weight = await api.weights.save({
        kg: Number(kg),
        loggedOn,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onSaved(weight);
    } catch (caught) {
      setError(caught);
    } finally {
      setIsSubmitting(false);
    }
  }

  const bannerError =
    error && !(error instanceof ApiError && error.fieldErrors.length > 0)
      ? errorMessage(error)
      : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {bannerError && <Alert>{bannerError}</Alert>}

      <label className="block">
        <span className="sr-only">Weight in kilograms</span>
        <span className="flex items-end gap-4">
          <input
            id="weightKg"
            type="number"
            inputMode="decimal"
            min={0.1}
            max={500}
            step={0.1}
            required
            placeholder="0.0"
            value={kg}
            aria-invalid={Boolean(fieldError('kg')) || undefined}
            onChange={(event) => setKg(event.target.value)}
            className="w-full min-w-0 border-0 bg-transparent p-0 text-[3.5rem] font-semibold leading-none tracking-tight text-white tabular-nums shadow-none outline-none ring-0 placeholder:text-white/20 focus:outline-none focus:ring-0 sm:text-[6rem]"
          />
          <span className="mb-2 flex shrink-0 flex-col items-center gap-2">
            <span className="text-sm font-medium text-white/40">kg</span>
            <span className="flex flex-col gap-1">
              <StepButton label="Increase by 0.1 kg" onClick={() => nudge(0.1)}>
                <StepChevron />
              </StepButton>
              <StepButton label="Decrease by 0.1 kg" onClick={() => nudge(-0.1)}>
                <StepChevron down />
              </StepButton>
            </span>
          </span>
        </span>
        {fieldError('kg') && (
          <p role="alert" className="mt-2 text-xs text-accent">
            {fieldError('kg')}
          </p>
        )}
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-white/35">Date</p>
          <DateField
            id="weightLoggedOn"
            tone="ink"
            value={loggedOn}
            hasError={Boolean(fieldError('loggedOn'))}
            onChange={setLoggedOn}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.14em] text-white/35">Note</p>
          <input
            id="weightNote"
            type="text"
            maxLength={200}
            placeholder="Morning, after coffee…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-md border border-white/20 bg-white/8 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-accent"
          />
        </div>
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:mb-px sm:w-auto">
          Save weigh-in
        </Button>
      </div>

      <p className="text-xs text-white/40">
        {replacesToday
          ? 'Saving again replaces the reading already on this day.'
          : 'One number per day. Bite can read this log; it cannot write it.'}
      </p>
    </form>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-full border border-white/20 text-white/55 transition-colors hover:border-accent hover:text-accent"
    >
      {children}
    </button>
  );
}

function StepChevron({ down }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      {down ? <path d="M4 6.5 8 10.5 12 6.5" /> : <path d="M4 9.5 8 5.5 12 9.5" />}
    </svg>
  );
}

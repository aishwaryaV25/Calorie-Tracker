'use client';

import { cx } from '@/components/ui';

export function TargetSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  accent,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  accent: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const ratio = max > min ? (value - min) / (max - min) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <div className="flex items-baseline gap-2">
          {hint && <span className="text-xs text-subtle">{hint}</span>}
          <span className="text-sm font-semibold tabular-nums">
            {Number.isInteger(step) && step >= 1 ? Math.round(value).toLocaleString() : value}
            <span className="ml-1 font-normal text-subtle">{unit}</span>
          </span>
        </div>
      </div>

      <div className="relative h-2">
        <div className="absolute inset-0 rounded-full bg-surface-raised" />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(1, Math.max(0, ratio)) * 100}%`, background: accent }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cx(
            'absolute inset-0 w-full cursor-pointer appearance-none bg-transparent',
            '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-surface',
            '[&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--accent)]',
            '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent',
            '[&::-moz-range-thumb]:bg-surface',
          )}
        />
      </div>

      <div className="flex justify-between text-[11px] text-subtle">
        <span>
          {min.toLocaleString()} {unit}
        </span>
        <span>
          {max.toLocaleString()} {unit}
        </span>
      </div>
    </div>
  );
}

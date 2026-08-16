'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { formatCalories, todayKey } from '@/lib/format';
import { Alert, Button, DateField, Field, Input, cx } from '@/components/ui';
import { MealSummaryDonut } from '@/components/entries/MealSummaryDonut';
import { TargetSlider } from './TargetSlider';
import type { Goal } from '@/lib/types';

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

type Intent = 'lose_fat' | 'build_muscle' | 'maintain';

const INTENTS: {
  id: Intent;
  label: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}[] = [
  {
    id: 'lose_fat',
    label: 'Lose fat',
    description: 'A leaner cut. Lower energy, protein held high.',
    calories: 2200,
    protein: 150,
    carbs: 250,
    fat: 73,
  },
  {
    id: 'build_muscle',
    label: 'Build muscle',
    description: 'A surplus to grow. More calories, more protein.',
    calories: 2600,
    protein: 180,
    carbs: 260,
    fat: 72,
  },
  {
    id: 'maintain',
    label: 'Maintain',
    description: 'Hold the line. Enough to train, not to drift.',
    calories: 2400,
    protein: 165,
    carbs: 240,
    fat: 73,
  },
];

function macroShare(grams: number, kcalPerGram: number, calories: number) {
  if (!(calories > 0) || !(grams > 0)) {
    return 0;
  }
  return Math.round(((grams * kcalPerGram) / calories) * 100);
}

function guessIntent(goal: Goal | null): Intent | null {
  if (!goal) {
    return null;
  }

  const match = INTENTS.find(
    (intent) =>
      intent.calories === Math.round(goal.dailyCalories) &&
      intent.protein === Math.round(goal.proteinGrams) &&
      intent.carbs === Math.round(goal.carbGrams) &&
      intent.fat === Math.round(goal.fatGrams),
  );

  return match?.id ?? null;
}

export function GoalComposer({
  currentGoal,
  onSaved,
}: {
  currentGoal: Goal | null;
  onSaved: (goal: Goal) => void;
}) {
  const [intent, setIntent] = useState<Intent | null>(() => guessIntent(currentGoal));
  const [calories, setCalories] = useState(currentGoal?.dailyCalories ?? 2200);
  const [protein, setProtein] = useState(currentGoal?.proteinGrams ?? 150);
  const [carbs, setCarbs] = useState(currentGoal?.carbGrams ?? 250);
  const [fat, setFat] = useState(currentGoal?.fatGrams ?? 73);
  const [targetWeightKg, setTargetWeightKg] = useState(
    currentGoal?.targetWeightKg == null ? '' : String(currentGoal.targetWeightKg),
  );
  const [effectiveFrom, setEffectiveFrom] = useState(currentGoal?.effectiveFrom ?? todayKey());
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  const fromMacros = protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
  const proteinPct = macroShare(protein, KCAL_PER_GRAM.protein, calories);
  const carbPct = macroShare(carbs, KCAL_PER_GRAM.carbs, calories);
  const fatPct = macroShare(fat, KCAL_PER_GRAM.fat, calories);

  function applyIntent(next: Intent) {
    const preset = INTENTS.find((item) => item.id === next);
    if (!preset) {
      return;
    }

    setIntent(next);
    setCalories(preset.calories);
    setProtein(preset.protein);
    setCarbs(preset.carbs);
    setFat(preset.fat);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const goal = await api.goals.save({
        dailyCalories: calories,
        proteinGrams: protein,
        carbGrams: carbs,
        fatGrams: fat,
        ...(targetWeightKg ? { targetWeightKg: Number(targetWeightKg) } : {}),
        ...(effectiveFrom ? { effectiveFrom } : {}),
      });

      onSaved(goal);
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {bannerError && <Alert>{bannerError}</Alert>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {INTENTS.map((item) => {
            const selected = intent === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => applyIntent(item.id)}
                className={cx(
                  'rounded-full px-3 py-1.5 text-xs transition-colors',
                  selected
                    ? 'bg-foreground text-surface'
                    : 'border border-border-strong text-muted hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <Button type="submit" isLoading={isSubmitting} className="min-w-32">
          Save goals
        </Button>
      </div>

      <section className="grid items-start gap-6 rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)] lg:grid-cols-[minmax(0,1fr)_minmax(13rem,16rem)]">
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold">Daily targets</h2>

          <TargetSlider
            id="dailyCalories"
            label="Calories"
            value={calories}
            min={1500}
            max={3500}
            step={10}
            unit="kcal"
            accent="var(--accent)"
            onChange={(value) => {
              setCalories(value);
              setIntent(null);
            }}
          />
          {fieldError('dailyCalories') && (
            <p className="text-xs text-danger">{fieldError('dailyCalories')}</p>
          )}

          <TargetSlider
            id="proteinGrams"
            label="Protein"
            value={protein}
            min={40}
            max={300}
            step={1}
            unit="g"
            hint={`${proteinPct}%`}
            accent="var(--protein)"
            onChange={(value) => {
              setProtein(value);
              setIntent(null);
            }}
          />

          <TargetSlider
            id="carbGrams"
            label="Carbs"
            value={carbs}
            min={40}
            max={500}
            step={1}
            unit="g"
            hint={`${carbPct}%`}
            accent="var(--carbs)"
            onChange={(value) => {
              setCarbs(value);
              setIntent(null);
            }}
          />

          <TargetSlider
            id="fatGrams"
            label="Fat"
            value={fat}
            min={20}
            max={180}
            step={1}
            unit="g"
            hint={`${fatPct}%`}
            accent="var(--fat)"
            onChange={(value) => {
              setFat(value);
              setIntent(null);
            }}
          />

          <p className="text-xs text-subtle">
            Macros add up to {formatCalories(fromMacros)} kcal
            {calories > 0 && ` vs a ${formatCalories(calories)} kcal target`}.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Target weight (kg)"
              htmlFor="targetWeightKg"
              error={fieldError('targetWeightKg')}
              hint="Optional."
            >
              <Input
                id="targetWeightKg"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.1}
                placeholder="66"
                value={targetWeightKg}
                hasError={Boolean(fieldError('targetWeightKg'))}
                onChange={(event) => {
                  setTargetWeightKg(event.target.value);
                }}
              />
            </Field>

            <Field
              label="Effective from"
              htmlFor="effectiveFrom"
              error={fieldError('effectiveFrom')}
              hint="Earlier days keep what they had."
            >
              <DateField
                id="effectiveFrom"
                value={effectiveFrom}
                hasError={Boolean(fieldError('effectiveFrom'))}
                onChange={setEffectiveFrom}
              />
            </Field>
          </div>
        </div>

        <div className="lg:pt-6">
          <MealSummaryDonut
            calories={calories}
            proteinGrams={protein}
            carbGrams={carbs}
            fatGrams={fat}
          />
        </div>
      </section>
    </form>
  );
}

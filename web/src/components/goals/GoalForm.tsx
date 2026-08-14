'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { todayKey } from '@/lib/format';
import { Alert, Button, Field, Input } from '@/components/ui';
import type { Goal } from '@/lib/types';

const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

/** Share of daily calories each macro takes under the auto-balance shortcut. */
const BALANCED_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 };

/** Calories the macro targets add up to, which should roughly match the calorie target. */
const macroCalories = (protein: number, carbs: number, fat: number) =>
  protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;

interface FormValues {
  dailyCalories: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  targetWeightKg: string;
  effectiveFrom: string;
}

const EMPTY_VALUES: FormValues = {
  dailyCalories: '',
  proteinGrams: '',
  carbGrams: '',
  fatGrams: '',
  targetWeightKg: '',
  effectiveFrom: todayKey(),
};

const toFormValues = (goal: Goal | null): FormValues =>
  goal
    ? {
        dailyCalories: String(goal.dailyCalories),
        proteinGrams: String(goal.proteinGrams),
        carbGrams: String(goal.carbGrams),
        fatGrams: String(goal.fatGrams),
        targetWeightKg: goal.targetWeightKg === null ? '' : String(goal.targetWeightKg),
        // Defaults to today rather than the current goal's own date: saving is
        // meant to start a new version from now, not silently rewrite an old one.
        effectiveFrom: todayKey(),
      }
    : EMPTY_VALUES;

interface GoalFormProps {
  /**
   * Prefills the inputs so editing starts from the targets already in force.
   * The caller keys this component on the goal, so a different goal remounts the
   * form with fresh values instead of needing an effect to copy props into state.
   */
  currentGoal: Goal | null;
  onSaved: (goal: Goal) => void;
}

export function GoalForm({ currentGoal, onSaved }: GoalFormProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(currentGoal));
  const [error, setError] = useState<unknown>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const set = (field: keyof FormValues) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    setSavedAt(null);
  };

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  const calories = Number(values.dailyCalories);
  const fromMacros = macroCalories(
    Number(values.proteinGrams) || 0,
    Number(values.carbGrams) || 0,
    Number(values.fatGrams) || 0,
  );

  // Rounding across three macros can never land exactly on the calorie target,
  // so only flag a gap big enough to mean the numbers were not meant to agree.
  const macroGap = calories > 0 && fromMacros > 0 ? Math.round(fromMacros - calories) : 0;
  const hasMacroMismatch = calories > 0 && Math.abs(macroGap) > Math.max(50, calories * 0.05);

  function autoBalance() {
    if (!(calories > 0)) {
      return;
    }

    setValues((current) => ({
      ...current,
      proteinGrams: String(
        Math.round((calories * BALANCED_SPLIT.protein) / KCAL_PER_GRAM.protein),
      ),
      carbGrams: String(Math.round((calories * BALANCED_SPLIT.carbs) / KCAL_PER_GRAM.carbs)),
      fatGrams: String(Math.round((calories * BALANCED_SPLIT.fat) / KCAL_PER_GRAM.fat)),
    }));
    setSavedAt(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const goal = await api.goals.save({
        dailyCalories: Number(values.dailyCalories),
        proteinGrams: Number(values.proteinGrams),
        carbGrams: Number(values.carbGrams),
        fatGrams: Number(values.fatGrams),
        // Omitted rather than sent as null: the field is optional on the API.
        ...(values.targetWeightKg ? { targetWeightKg: Number(values.targetWeightKg) } : {}),
        ...(values.effectiveFrom ? { effectiveFrom: values.effectiveFrom } : {}),
      });

      setSavedAt(goal.effectiveFrom);
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
      {savedAt && !error && (
        <Alert tone="info">Targets saved, effective from {savedAt}.</Alert>
      )}

      <Field
        label="Daily calories"
        htmlFor="dailyCalories"
        error={fieldError('dailyCalories')}
        hint="Your overall energy target for a day."
      >
        <Input
          id="dailyCalories"
          type="number"
          inputMode="numeric"
          min={1}
          step={10}
          placeholder="2200"
          value={values.dailyCalories}
          hasError={Boolean(fieldError('dailyCalories'))}
          onChange={set('dailyCalories')}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">Macro targets</p>
          <Button
            type="button"
            variant="ghost"
            onClick={autoBalance}
            disabled={!(calories > 0)}
            className="px-2 py-1 text-xs"
          >
            Auto-balance 30/40/30
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Protein (g)" htmlFor="proteinGrams" error={fieldError('proteinGrams')}>
            <Input
              id="proteinGrams"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="165"
              value={values.proteinGrams}
              hasError={Boolean(fieldError('proteinGrams'))}
              onChange={set('proteinGrams')}
            />
          </Field>

          <Field label="Carbs (g)" htmlFor="carbGrams" error={fieldError('carbGrams')}>
            <Input
              id="carbGrams"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="220"
              value={values.carbGrams}
              hasError={Boolean(fieldError('carbGrams'))}
              onChange={set('carbGrams')}
            />
          </Field>

          <Field label="Fat (g)" htmlFor="fatGrams" error={fieldError('fatGrams')}>
            <Input
              id="fatGrams"
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              placeholder="73"
              value={values.fatGrams}
              hasError={Boolean(fieldError('fatGrams'))}
              onChange={set('fatGrams')}
            />
          </Field>
        </div>

        {fromMacros > 0 && (
          <p className={hasMacroMismatch ? 'text-xs text-danger' : 'text-xs text-subtle'}>
            Macros add up to {Math.round(fromMacros).toLocaleString()} kcal
            {calories > 0 && (
              <>
                {' '}
                ({macroGap === 0 ? 'matching' : `${macroGap > 0 ? '+' : ''}${macroGap} vs`} your
                calorie target)
              </>
            )}
            .
          </p>
        )}
      </div>

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
            placeholder="72"
            value={values.targetWeightKg}
            hasError={Boolean(fieldError('targetWeightKg'))}
            onChange={set('targetWeightKg')}
          />
        </Field>

        <Field
          label="Effective from"
          htmlFor="effectiveFrom"
          error={fieldError('effectiveFrom')}
          hint="Earlier days keep the targets they had."
        >
          <Input
            id="effectiveFrom"
            type="date"
            value={values.effectiveFrom}
            hasError={Boolean(fieldError('effectiveFrom'))}
            onChange={set('effectiveFrom')}
          />
        </Field>
      </div>

      <Button type="submit" isLoading={isSubmitting} className="sm:self-start">
        {currentGoal ? 'Update targets' : 'Set targets'}
      </Button>
    </form>
  );
}

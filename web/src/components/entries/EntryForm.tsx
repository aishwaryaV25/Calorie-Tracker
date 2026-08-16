'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { Alert, Button, DateTimeField, Field, Input, Select } from '@/components/ui';
import { PhotoExtract } from './PhotoExtract';
import { MicronutrientFields } from './MicronutrientFields';
import { MEAL_LABELS, MEAL_TYPES, type FoodEntry, type MealType, type Micronutrient } from '@/lib/types';

export interface EntryFormProps {
  /** Editing an existing entry when provided, creating a new one otherwise. */
  entry?: FoodEntry | null;
  defaultMealType?: MealType;
  isAiAvailable: boolean;
  onSaved: (entry: FoodEntry) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

interface FormValues {
  foodName: string;
  mealType: MealType;
  quantity: string;
  unit: string;
  calories: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  consumedAt: string;
}

/** `datetime-local` expects local wall-clock time, not a UTC ISO string. */
function toLocalInputValue(isoTimestamp?: string): string {
  const date = isoTimestamp ? new Date(isoTimestamp) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * A `datetime-local` input reports an empty string while its value is
 * incomplete, and converting an invalid Date throws rather than returning NaN.
 * Returning null instead lets the caller report the problem on the field.
 */
function toIsoTimestamp(localValue: string): string | null {
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const initialValues = (entry: FoodEntry | null | undefined, mealType: MealType): FormValues =>
  entry
    ? {
        foodName: entry.foodName,
        mealType: entry.mealType,
        quantity: String(entry.quantity),
        unit: entry.unit,
        calories: String(entry.calories),
        proteinGrams: String(entry.macros.proteinGrams),
        carbGrams: String(entry.macros.carbGrams),
        fatGrams: String(entry.macros.fatGrams),
        consumedAt: toLocalInputValue(entry.consumedAt),
      }
    : {
        foodName: '',
        mealType,
        quantity: '',
        unit: 'g',
        calories: '',
        proteinGrams: '',
        carbGrams: '',
        fatGrams: '',
        consumedAt: toLocalInputValue(),
      };

/**
 * The meal entry form. Used both inside the dialog on the dashboard and as the
 * full-page Log Meal view, so the two cannot drift apart.
 */
export function EntryForm({
  entry,
  defaultMealType = 'breakfast',
  isAiAvailable,
  onSaved,
  onCancel,
  submitLabel,
}: EntryFormProps) {
  const isEditing = Boolean(entry);

  const [values, setValues] = useState<FormValues>(() => initialValues(entry, defaultMealType));
  const [micronutrients, setMicronutrients] = useState<Micronutrient[]>(entry?.micronutrients ?? []);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setValue = (key: keyof FormValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  function resetForm() {
    setValues(initialValues(null, defaultMealType));
    setMicronutrients([]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // The input holds local time; the API stores the absolute instant.
    const consumedAt = toIsoTimestamp(values.consumedAt);

    if (!consumedAt) {
      // Reported through the same channel as a server rejection, so it lands
      // under the field rather than in a banner.
      setError(
        new ApiError(400, 'VALIDATION_ERROR', 'Check the highlighted field.', [
          { field: 'consumedAt', message: 'Enter a full date and time.' },
        ]),
      );
      return;
    }

    const missing: { field: string; message: string }[] = [];
    if (!values.foodName.trim()) missing.push({ field: 'foodName', message: 'Food name is required.' });
    if (!values.quantity.trim() || Number(values.quantity) <= 0) {
      missing.push({ field: 'quantity', message: 'Quantity must be greater than zero.' });
    }
    if (!values.unit.trim()) missing.push({ field: 'unit', message: 'Unit is required.' });
    if (values.calories.trim() === '') missing.push({ field: 'calories', message: 'Calories are required.' });
    if (values.proteinGrams.trim() === '') missing.push({ field: 'proteinGrams', message: 'Protein is required.' });
    if (values.carbGrams.trim() === '') missing.push({ field: 'carbGrams', message: 'Carbs are required.' });
    if (values.fatGrams.trim() === '') missing.push({ field: 'fatGrams', message: 'Fat is required.' });

    if (missing.length > 0) {
      setError(new ApiError(400, 'VALIDATION_ERROR', 'Fill in the required fields.', missing));
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        foodName: values.foodName.trim(),
        mealType: values.mealType,
        quantity: Number(values.quantity),
        unit: values.unit.trim(),
        calories: Number(values.calories),
        proteinGrams: Number(values.proteinGrams),
        carbGrams: Number(values.carbGrams),
        fatGrams: Number(values.fatGrams),
        consumedAt,
        // The date exactly as it was picked. Sent alongside the instant because
        // the server cannot tell which calendar day a UTC timestamp belongs to
        // without knowing the user's time zone — an 00:30 entry in Delhi would
        // otherwise be filed under the previous day.
        consumedOn: values.consumedAt.slice(0, 10),
        micronutrients: micronutrients.map((item) => ({
          nutrient: item.nutrient,
          amount: item.amount,
          unit: item.unit,
        })),
      };

      const saved = entry
        ? await api.entries.update(entry.id, payload)
        : await api.entries.create(payload);

      if (!entry) {
        // Clears the form so several items can be logged in a row without
        // the previous values lingering.
        resetForm();
      }

      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(errorMessage(caught)));
    } finally {
      setIsSaving(false);
    }
  }

  // Field-level messages render inline, so a banner would just repeat them.
  const bannerError =
    error && !(error instanceof ApiError && error.fieldErrors.length > 0) ? error.message : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {bannerError && <Alert>{bannerError}</Alert>}

      {!isEditing && (
        <PhotoExtract
          isAvailable={isAiAvailable}
          onApply={(result) => {
            const { entry } = result;

            setValues((current) => ({
              ...current,
              foodName: entry.foodName,
              quantity: String(entry.quantity),
              unit: entry.unit,
              calories: String(entry.calories),
              proteinGrams: String(entry.proteinGrams),
              carbGrams: String(entry.carbGrams),
              fatGrams: String(entry.fatGrams),
              mealType: result.suggestedMealType ?? current.mealType,
              // `consumedAt` is deliberately untouched: the photo says what was
              // eaten, not when the user is recording it.
            }));
            setMicronutrients(entry.micronutrients);
          }}
        />
      )}

      <Field label="Food name" htmlFor="foodName" error={fieldError('foodName')} required>
        <Input
          id="foodName"
          value={values.foodName}
          hasError={Boolean(fieldError('foodName'))}
          placeholder="Greek yoghurt"
          onChange={(event) => setValue('foodName', event.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Meal" htmlFor="mealType" error={fieldError('mealType')}>
          <Select
            id="mealType"
            value={values.mealType}
            onChange={(event) => setValue('mealType', event.target.value)}
          >
            {MEAL_TYPES.map((meal) => (
              <option key={meal} value={meal}>
                {MEAL_LABELS[meal]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="When" htmlFor="consumedAt" error={fieldError('consumedAt')}>
          <DateTimeField
            id="consumedAt"
            value={values.consumedAt}
            hasError={Boolean(fieldError('consumedAt'))}
            onChange={(consumedAt) => setValue('consumedAt', consumedAt)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Quantity" htmlFor="quantity" error={fieldError('quantity')} required>
          <Input
            id="quantity"
            type="number"
            step="any"
            min="0"
            value={values.quantity}
            hasError={Boolean(fieldError('quantity'))}
            placeholder="200"
            onChange={(event) => setValue('quantity', event.target.value)}
          />
        </Field>

        <Field label="Unit" htmlFor="unit" error={fieldError('unit')} required>
          <Input
            id="unit"
            value={values.unit}
            hasError={Boolean(fieldError('unit'))}
            placeholder="g"
            onChange={(event) => setValue('unit', event.target.value)}
          />
        </Field>

        <Field label="Calories" htmlFor="calories" error={fieldError('calories')} required>
          <Input
            id="calories"
            type="number"
            step="any"
            min="0"
            value={values.calories}
            hasError={Boolean(fieldError('calories'))}
            placeholder="146"
            onChange={(event) => setValue('calories', event.target.value)}
          />
        </Field>
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1.5 text-sm font-medium">
          Macros (grams) <span className="text-accent">*</span>
        </legend>
        <Field label="Protein" htmlFor="proteinGrams" error={fieldError('proteinGrams')} required>
          <Input
            id="proteinGrams"
            type="number"
            step="any"
            min="0"
            value={values.proteinGrams}
            placeholder="0"
            onChange={(event) => setValue('proteinGrams', event.target.value)}
          />
        </Field>
        <Field label="Carbs" htmlFor="carbGrams" error={fieldError('carbGrams')} required>
          <Input
            id="carbGrams"
            type="number"
            step="any"
            min="0"
            value={values.carbGrams}
            placeholder="0"
            onChange={(event) => setValue('carbGrams', event.target.value)}
          />
        </Field>
        <Field label="Fat" htmlFor="fatGrams" error={fieldError('fatGrams')} required>
          <Input
            id="fatGrams"
            type="number"
            step="any"
            min="0"
            value={values.fatGrams}
            placeholder="0"
            onChange={(event) => setValue('fatGrams', event.target.value)}
          />
        </Field>
      </fieldset>

      <MicronutrientFields idPrefix="entry-micro" value={micronutrients} onChange={setMicronutrients} />

      <div className="mt-1 flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSaving}>
          {submitLabel ?? (isEditing ? 'Save changes' : 'Add entry')}
        </Button>
      </div>
    </form>
  );
}

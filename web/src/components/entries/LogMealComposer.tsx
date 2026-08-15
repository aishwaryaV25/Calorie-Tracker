'use client';

import { useId, useState, type DragEvent, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { formatCalories } from '@/lib/format';
import { Alert, Badge, Button, Field, Input, Textarea, cx } from '@/components/ui';
import { MealSummaryDonut } from './MealSummaryDonut';
import { MicronutrientFields } from './MicronutrientFields';
import {
  MEAL_LABELS,
  MEAL_TYPES,
  type ExtractionResult,
  type FoodEntry,
  type MealType,
  type Micronutrient,
} from '@/lib/types';

interface MealValues {
  foodName: string;
  quantity: string;
  unit: string;
  calories: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
}

const emptyMeal = (): MealValues => ({
  foodName: '',
  quantity: '',
  unit: 'g',
  calories: '',
  proteinGrams: '',
  carbGrams: '',
  fatGrams: '',
});

interface LogMealComposerProps {
  isAiAvailable: boolean;
  onSaved: (entries: FoodEntry[]) => void;
}

function toLocalInputValue(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoTimestamp(localValue: string): string | null {
  const parsed = new Date(localValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * One diary row per meal. The assignment fields live on that meal. Detected
 * plate items are shown on the side so the estimate can be judged; they are
 * not saved as their own entries.
 */
export function LogMealComposer({ isAiAvailable, onSaved }: LogMealComposerProps) {
  const fileInputId = useId();

  const [mealType, setMealType] = useState<MealType>('breakfast');
  const [values, setValues] = useState<MealValues>(emptyMeal);
  const [micronutrients, setMicronutrients] = useState<Micronutrient[]>([]);
  const [consumedAt, setConsumedAt] = useState(toLocalInputValue);
  const [notes, setNotes] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const usedPhoto = Boolean(extraction);
  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldError(field) : undefined;

  const setValue = (key: keyof MealValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function resetComposer() {
    setMealType('breakfast');
    setValues(emptyMeal());
    setMicronutrients([]);
    setConsumedAt(toLocalInputValue());
    setNotes('');
    setExtraction(null);
    setExtractError(null);
    setError(null);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }

  function applyExtraction(result: ExtractionResult) {
    const { entry } = result;
    setExtraction(result);
    setExtractError(null);

    if (result.suggestedMealType) {
      setMealType(result.suggestedMealType);
    }

    setValues({
      foodName: entry.foodName,
      quantity: String(entry.quantity),
      unit: entry.unit,
      calories: String(entry.calories),
      proteinGrams: String(entry.proteinGrams),
      carbGrams: String(entry.carbGrams),
      fatGrams: String(entry.fatGrams),
    });
    setMicronutrients(entry.micronutrients);
  }

  async function handleFile(file: File) {
    if (!isAiAvailable) {
      setExtractError('Photo reading is off on the server. Fill in the meal by hand.');
      return;
    }

    setExtractError(null);
    setIsExtracting(true);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    try {
      applyExtraction(await api.ai.extract(file));
    } catch (caught) {
      setExtractError(errorMessage(caught));
    } finally {
      setIsExtracting(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const consumedAtIso = toIsoTimestamp(consumedAt);
    if (!consumedAtIso) {
      setError(
        new ApiError(400, 'VALIDATION_ERROR', 'Check the highlighted field.', [
          { field: 'consumedAt', message: 'Enter a full date and time.' },
        ]),
      );
      return;
    }

    const details: { field: string; message: string }[] = [];
    if (!values.foodName.trim()) details.push({ field: 'foodName', message: 'Food name is required.' });
    if (!values.quantity.trim() || Number(values.quantity) <= 0) {
      details.push({ field: 'quantity', message: 'Quantity must be greater than zero.' });
    }
    if (!values.unit.trim()) details.push({ field: 'unit', message: 'Unit is required.' });
    if (values.calories.trim() === '' || Number(values.calories) < 0) {
      details.push({ field: 'calories', message: 'Calories are required.' });
    }

    if (details.length > 0) {
      setError(new ApiError(400, 'VALIDATION_ERROR', 'Fill in the required meal fields.', details));
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        foodName: values.foodName.trim(),
        mealType,
        quantity: Number(values.quantity),
        unit: values.unit.trim(),
        calories: Number(values.calories),
        proteinGrams: toNumber(values.proteinGrams),
        carbGrams: toNumber(values.carbGrams),
        fatGrams: toNumber(values.fatGrams),
        consumedAt: consumedAtIso,
        consumedOn: consumedAt.slice(0, 10),
        notes: notes.trim() || undefined,
        micronutrients: micronutrients.map((item) => ({
          nutrient: item.nutrient,
          amount: item.amount,
          unit: item.unit,
        })),
      };

      const saved = (
        await api.entries.batch({
          entries: [payload],
          source: usedPhoto ? 'image' : 'manual',
        })
      ).data;

      resetComposer();
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error(errorMessage(caught)));
    } finally {
      setIsSaving(false);
    }
  }

  const bannerError =
    error && !(error instanceof ApiError && error.fieldErrors.length > 0) ? error.message : null;

  const plateItems = extraction?.components ?? [];
  const hasPhoto = Boolean(previewUrl);

  const mealDetails = (
    <div className="flex flex-col gap-5">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1.5 text-sm font-medium">Protein, carbs, fat</legend>
        <Field label="Protein (g)" htmlFor="proteinGrams" error={fieldError('proteinGrams')}>
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
        <Field label="Carbs (g)" htmlFor="carbGrams" error={fieldError('carbGrams')}>
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
        <Field label="Fat (g)" htmlFor="fatGrams" error={fieldError('fatGrams')}>
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

      <MicronutrientFields idPrefix="meal-micro" value={micronutrients} onChange={setMicronutrients} />

      <Field label="When" htmlFor="consumedAt" error={fieldError('consumedAt')} required>
        <Input
          id="consumedAt"
          type="datetime-local"
          required
          value={consumedAt}
          hasError={Boolean(fieldError('consumedAt'))}
          onChange={(event) => setConsumedAt(event.target.value)}
        />
      </Field>

      <Field label="Notes" htmlFor="notes" error={fieldError('notes')} hint="Optional.">
        <Textarea
          id="notes"
          value={notes}
          placeholder="Anything you want to remember about this meal."
          onChange={(event) => setNotes(event.target.value)}
        />
      </Field>

      {bannerError && <Alert>{bannerError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={isSaving} className="min-w-36">
          Add meal
        </Button>
        <Button type="button" variant="secondary" onClick={resetComposer}>
          Clear
        </Button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {MEAL_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setMealType(type)}
            className={cx(
              'rounded-full px-4 py-1.5 text-sm transition-colors',
              mealType === type
                ? 'bg-accent font-medium text-on-accent'
                : 'border border-border bg-surface text-muted hover:text-foreground',
            )}
          >
            {MEAL_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="flex flex-col gap-5">
          <label
            htmlFor={fileInputId}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={cx(
              'flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-surface px-6 py-8 text-center transition-colors',
              isDragging ? 'border-accent bg-accent-soft' : 'border-border-strong',
            )}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Uploaded meal" className="max-h-44 w-full rounded-lg object-cover" />
            ) : (
              <>
                <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <CameraIcon />
                </span>
                <div>
                  <p className="text-sm font-medium">
                    Upload a photo of your meal or nutrition label or drag & drop here.
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {isAiAvailable
                      ? 'AI fills the meal fields. You can still edit them.'
                      : 'Photo reading is off. Fill in the meal by hand.'}
                  </p>
                </div>
              </>
            )}
            {isExtracting && <p className="text-sm text-muted">Reading the photo…</p>}
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
              event.target.value = '';
            }}
          />

          {extractError && <Alert>{extractError}</Alert>}

          {extraction && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="accent">
                {extraction.source === 'nutrition_label' ? 'Nutrition label' : 'Meal photo'}
              </Badge>
              <Badge>{extraction.confidence} confidence</Badge>
              {extraction.notes && <p className="text-xs text-muted">{extraction.notes}</p>}
            </div>
          )}

          {extraction?.warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          <Field label="Food name" htmlFor="foodName" error={fieldError('foodName')} required>
            <Input
              id="foodName"
              value={values.foodName}
              required
              hasError={Boolean(fieldError('foodName'))}
              placeholder="e.g., Fried egg sandwich"
              onChange={(event) => setValue('foodName', event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Quantity" htmlFor="quantity" error={fieldError('quantity')} required>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                required
                value={values.quantity}
                hasError={Boolean(fieldError('quantity'))}
                placeholder="1"
                onChange={(event) => setValue('quantity', event.target.value)}
              />
            </Field>
            <Field label="Unit" htmlFor="unit" error={fieldError('unit')} required>
              <Input
                id="unit"
                value={values.unit}
                required
                hasError={Boolean(fieldError('unit'))}
                placeholder="plate"
                onChange={(event) => setValue('unit', event.target.value)}
              />
            </Field>
            <Field label="Calories" htmlFor="calories" error={fieldError('calories')} required>
              <Input
                id="calories"
                type="number"
                step="any"
                min="0"
                required
                value={values.calories}
                hasError={Boolean(fieldError('calories'))}
                placeholder="445"
                onChange={(event) => setValue('calories', event.target.value)}
              />
            </Field>
          </div>

          {hasPhoto && mealDetails}
        </div>

        <div className="flex flex-col gap-4">
          {hasPhoto ? (
            <>
              <section className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
                <header className="mb-4">
                  <h2 className="text-sm font-semibold">AI detected</h2>
                  <p className="mt-0.5 text-xs text-subtle">
                    Shown so you can judge the estimate. Only the meal on the left is saved.
                  </p>
                </header>

                {isExtracting && plateItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Reading the plate…</p>
                ) : plateItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">
                    No separate foods were listed for this photo.
                  </p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {plateItems.map((item) => (
                      <li key={item.name} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm">{item.name}</p>
                          <p className="text-xs text-subtle">
                            {item.quantity} {item.unit}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm tabular-nums">
                          {formatCalories(item.calories)} kcal
                        </span>
                      </li>
                    ))}
                    <li className="flex items-center justify-between pt-3 text-sm font-medium">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCalories(toNumber(values.calories))} kcal</span>
                    </li>
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
                <h2 className="mb-4 text-sm font-semibold">This meal summary</h2>
                <MealSummaryDonut
                  calories={toNumber(values.calories)}
                  proteinGrams={toNumber(values.proteinGrams)}
                  carbGrams={toNumber(values.carbGrams)}
                  fatGrams={toNumber(values.fatGrams)}
                />
              </section>
            </>
          ) : (
            <section className="rounded-xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
              {mealDetails}
            </section>
          )}
        </div>
      </div>
    </form>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="14" r="3.5" />
    </svg>
  );
}

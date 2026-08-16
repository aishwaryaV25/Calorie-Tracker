'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { formatCalories } from '@/lib/format';
import { Alert, Badge, Button } from '@/components/ui';
import type { ExtractionResult } from '@/lib/types';

interface PhotoExtractProps {
  isAvailable: boolean;
  onApply: (result: ExtractionResult) => void;
}

export function PhotoExtract({ isAvailable, onApply }: PhotoExtractProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setIsExtracting(true);

    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    try {
      const extracted = await api.ai.extract(file);
      setResult(extracted);
      onApply(extracted);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsExtracting(false);
    }
  }

  if (!isAvailable) {
    return (
      <Alert tone="info">
        Photo extraction is turned off because the server has no AI key configured. You can still
        add entries by hand.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Fill from a photo</p>
          <p className="text-xs text-muted">
            Upload a nutrition label or a photo of your plate and the fields below fill in
            automatically.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          isLoading={isExtracting}
          onClick={() => inputRef.current?.click()}
        >
          {isExtracting ? 'Reading…' : 'Choose photo'}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }

          event.target.value = '';
        }}
      />

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Uploaded food"
          className="max-h-40 w-full rounded-lg object-cover"
        />
      )}

      {error && <Alert>{error}</Alert>}

      {result && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">
              {result.source === 'nutrition_label' ? 'Nutrition label' : 'Meal photo'}
            </Badge>
            <Badge>{result.confidence} confidence</Badge>
            {result.suggestedMealType && <Badge>{result.suggestedMealType}</Badge>}
          </div>

          <p className="text-sm">
            Filled in <span className="font-medium">{result.entry.foodName}</span> —{' '}
            {formatCalories(result.entry.calories)} kcal, {result.entry.proteinGrams}p /{' '}
            {result.entry.carbGrams}c / {result.entry.fatGrams}f
          </p>

          {result.components.length > 0 && (
            <div className="rounded-lg bg-surface-raised p-3">
              <p className="mb-1.5 text-xs font-medium text-muted">What the total is made of</p>
              <ul className="flex flex-col gap-1">
                {result.components.map((component) => (
                  <li
                    key={component.name}
                    className="flex items-baseline justify-between gap-3 text-xs"
                  >
                    <span className="min-w-0 truncate">{component.name}</span>
                    <span className="shrink-0 tabular-nums text-subtle">
                      {formatCalories(component.calories)} kcal
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.confidence === 'low' && (
            <Alert tone="warning">
              The image was hard to read, so please double-check the numbers below.
            </Alert>
          )}

          {result.warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          {result.notes && <p className="text-xs text-muted">{result.notes}</p>}
        </div>
      )}
    </div>
  );
}

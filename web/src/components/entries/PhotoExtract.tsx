'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { formatCalories } from '@/lib/format';
import { Alert, Badge, Button } from '@/components/ui';
import type { ExtractedItem, ExtractionResult } from '@/lib/types';

interface PhotoExtractProps {
  isAvailable: boolean;
  onApply: (item: ExtractedItem, result: ExtractionResult) => void;
}

/**
 * Uploads a nutrition label or meal photo and offers the extracted items to the
 * form. Nothing is saved here: the user picks an item, the fields are filled in,
 * and they confirm the numbers before the entry is created.
 */
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

    // Revoked before replacing so repeated uploads do not leak object URLs.
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });

    try {
      setResult(await api.ai.extract(file));
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
            Upload a nutrition label or a photo of your plate to pre-fill the fields.
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
          // Reset so choosing the same file twice still fires a change event.
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

          {result.confidence === 'low' && (
            <Alert tone="warning">
              The image was hard to read, so please double-check these numbers.
            </Alert>
          )}

          {result.warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          {result.notes && <p className="text-xs text-muted">{result.notes}</p>}

          <ul className="flex flex-col gap-2">
            {result.items.map((item, index) => (
              <li
                key={`${item.foodName}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-raised px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{item.foodName}</p>
                  <p className="text-xs text-muted">
                    {item.quantity} {item.unit} · {formatCalories(item.calories)} kcal ·{' '}
                    {item.proteinGrams}p / {item.carbGrams}c / {item.fatGrams}f
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => onApply(item, result)}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

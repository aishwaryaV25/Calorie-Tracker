'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';
import { EntryForm } from './EntryForm';
import type { FoodEntry, MealType } from '@/lib/types';

interface EntryFormModalProps {
  entry?: FoodEntry | null;
  defaultMealType?: MealType;
  isAiAvailable: boolean;
  onClose: () => void;
  /** Receives the saved entry so callers can report what changed. */
  onSaved: (entry: FoodEntry) => void;
}

/** Dialog wrapper around the shared entry form, used from the dashboard. */
export function EntryFormModal({
  entry,
  defaultMealType = 'breakfast',
  isAiAvailable,
  onClose,
  onSaved,
}: EntryFormModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    // Stops the page behind the dialog from scrolling.
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={entry ? 'Edit entry' : 'Add entry'}
      onMouseDown={(event) => {
        // Only a press that starts and ends on the backdrop closes the dialog, so
        // dragging out of the panel does not discard a half-filled form.
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="my-8 w-full max-w-lg rounded-xl border border-border bg-surface p-6 shadow-[0_16px_48px_rgb(17_17_19/0.14)]">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{entry ? 'Edit entry' : 'Add entry'}</h2>
          <Button type="button" variant="ghost" onClick={onClose} className="px-2 py-1">
            Close
          </Button>
        </header>

        <EntryForm
          entry={entry}
          defaultMealType={defaultMealType}
          isAiAvailable={isAiAvailable}
          onCancel={onClose}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}

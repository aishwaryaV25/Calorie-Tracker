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

  onSaved: (entry: FoodEntry) => void;
}

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

    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-foreground/30 p-0 backdrop-blur-sm sm:items-start sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={entry ? 'Edit entry' : 'Add entry'}
      onMouseDown={(event) => {

        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-t-3xl border border-border bg-surface p-5 shadow-[0_16px_48px_rgb(17_17_19/0.14)] sm:my-8 sm:rounded-xl sm:p-6">
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

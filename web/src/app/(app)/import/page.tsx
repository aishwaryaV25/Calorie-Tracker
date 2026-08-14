'use client';

import { EmptyState } from '@/components/ui';

export default function ImportPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold tracking-tight">Import</h1>
      <EmptyState
        title="Not built yet"
        description="Bulk import of a food diary from a PDF is coming in a later step."
      />
    </div>
  );
}

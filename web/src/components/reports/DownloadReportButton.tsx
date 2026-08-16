'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui';
import { queryRange, type DateRange } from './ReportRangePicker';

export function DownloadReportButton({
  range,
  isDisabled = false,
  onError,
}: {
  range: DateRange;
  isDisabled?: boolean;

  onError: (message: string | null) => void;
}) {
  const [isBuilding, setIsBuilding] = useState(false);

  async function download() {
    setIsBuilding(true);
    onError(null);

    try {
      const { blob, filename } = await api.reports.pdf(queryRange(range));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'The report could not be built.');
    } finally {
      setIsBuilding(false);
    }
  }

  return (
    <Button
      onClick={() => void download()}
      isLoading={isBuilding}
      disabled={isDisabled}
      className="px-3 py-1.5 text-xs"
      title="Download a PDF of this date range"
    >
      {!isBuilding && <DownloadIcon />}
      {isBuilding ? 'Building…' : 'Download PDF'}
    </Button>
  );
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v8" />
      <path d="M4.5 7 8 10.5 11.5 7" />
      <path d="M2.5 13h11" />
    </svg>
  );
}

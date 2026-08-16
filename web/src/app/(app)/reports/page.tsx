'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, formatDateKey } from '@/lib/format';
import { Alert, Button, Card, Pagination, Skeleton } from '@/components/ui';
import { CalorieTrendChart, WeeklyCaloriesChart } from '@/components/reports/CalorieTrendChart';
import { DownloadReportButton } from '@/components/reports/DownloadReportButton';
import { GoalComparisonChart } from '@/components/reports/GoalComparisonChart';
import { MacroBreakdownChart } from '@/components/reports/MacroBreakdownChart';
import { MicronutrientTable } from '@/components/reports/MicronutrientTable';
import {
  defaultRange,
  queryRange,
  rangeDays,
  rangeLabel,
  ReportRangePicker,
  type DateRange,
} from '@/components/reports/ReportRangePicker';
import { useDataRevision } from '@/lib/data-sync';
import type { GoalComparison } from '@/lib/types';

const MAX_ROWS_PER_PAGE = 100;
const MICRONUTRIENTS_PER_PAGE = 8;

function rangeWarning(range: DateRange): string | null {
  if (!range.from || !range.to) {
    return 'Enter both a start and an end date. Until then the reports stay on the last 30 days.';
  }

  return rangeDays(range) === null ? 'Those dates could not be read.' : null;
}

export default function ReportsPage() {
  const dataRevision = useDataRevision();
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [microPage, setMicroPage] = useState(1);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const days = rangeDays(range);
  const warning = rangeWarning(range);
  const dailyPageSize = Math.min(days ?? 30, MAX_ROWS_PER_PAGE);
  const weeklyPageSize = Math.min(Math.ceil((days ?? 30) / 7) + 1, MAX_ROWS_PER_PAGE);

  const dates = queryRange(range);

  const daily = useAsync(
    () => api.reports.daily({ ...dates, pageSize: dailyPageSize }),
    [dates.from, dates.to, dailyPageSize, dataRevision],
  );
  const weekly = useAsync(
    () => api.reports.weekly({ ...dates, pageSize: weeklyPageSize }),
    [dates.from, dates.to, weeklyPageSize, dataRevision],
  );
  const macros = useAsync(() => api.reports.macros(dates), [dates.from, dates.to, dataRevision]);
  const comparison = useAsync(
    () => api.reports.goalComparison(dates),
    [dates.from, dates.to, dataRevision],
  );
  const micronutrients = useAsync(
    () =>
      api.reports.micronutrients({
        ...dates,
        page: microPage,
        pageSize: MICRONUTRIENTS_PER_PAGE,
      }),
    [dates.from, dates.to, microPage, dataRevision],
  );

  function applyRange(next: DateRange) {
    setRange(next);

    setMicroPage(1);
    setDownloadError(null);
  }

  const error = daily.error ?? weekly.error ?? macros.error ?? comparison.error;

  const trendRows = [...(daily.data?.data ?? [])].reverse();
  const isTruncated = days !== null && days > MAX_ROWS_PER_PAGE;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Nutrition</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Calorie trends, macros, and how they compare to your goal.
          </p>
        </div>
        <Link href="/log">
          <Button variant="secondary">Log a meal</Button>
        </Link>
      </header>

      <Card className="rounded-2xl">
        <ReportRangePicker value={range} onChange={applyRange} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted">{rangeLabel(range)}</p>
          <DownloadReportButton
            range={range}
            isDisabled={warning !== null}
            onError={setDownloadError}
          />
        </div>
      </Card>

      {}
      {warning ? (
        <Alert tone="warning">{warning}</Alert>
      ) : (
        (downloadError ?? error) && <Alert>{downloadError ?? error}</Alert>
      )}

      <SummaryTiles comparison={comparison.data} isLoading={comparison.isLoading} />

      <Card
        title="Daily calories"
        description={
          isTruncated
            ? `Showing the most recent ${MAX_ROWS_PER_PAGE} days of this range`
            : 'Bars are what you logged; the dashed line is your target that day'
        }
      >
        {daily.isLoading && !daily.data ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <CalorieTrendChart rows={trendRows} />
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Macro split" description="Share of energy across the range">
          {macros.isLoading && !macros.data ? (
            <Skeleton className="h-44 w-full" />
          ) : (
            macros.data && <MacroBreakdownChart breakdown={macros.data} />
          )}
        </Card>

        <Card title="Goal vs actual" description="Totals for the range against the targets in force">
          {comparison.isLoading && !comparison.data ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            comparison.data && <GoalComparisonChart comparison={comparison.data} />
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Weekly totals" description="Calories per ISO week">
          {weekly.isLoading && !weekly.data ? (
            <Skeleton className="h-56 w-full" />
          ) : (

            <WeeklyCaloriesChart rows={[...(weekly.data?.data ?? [])].reverse()} />
          )}
        </Card>

        <Card
          title="Micronutrients"
          description={
            micronutrients.data
              ? `${micronutrients.data.meta.totalItems} tracked in this range`
              : undefined
          }
        >
          {micronutrients.isLoading && !micronutrients.data ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            micronutrients.data && (
              <>
                <div
                  className={
                    micronutrients.isLoading ? 'opacity-60 transition-opacity' : undefined
                  }
                >
                  <MicronutrientTable
                    rows={micronutrients.data.data}
                    days={micronutrients.data.days}
                  />
                </div>
                <Pagination {...micronutrients.data.meta} onPageChange={setMicroPage} />
              </>
            )
          )}
        </Card>
      </div>
    </div>
  );
}

function SummaryTiles({
  comparison,
  isLoading,
}: {
  comparison: GoalComparison | null;
  isLoading: boolean;
}) {
  if (isLoading && !comparison) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[76px] w-full" />
        ))}
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryTile
        label="Range"
        value={`${formatDateKey(comparison.range.from)} – ${formatDateKey(comparison.range.to)}`}
        hint={`${comparison.range.days} days`}
      />
      <SummaryTile
        label="Calories logged"
        value={`${formatCalories(comparison.actual.calories)} kcal`}
        hint={`${formatCalories(comparison.actual.averageDailyCalories)} kcal on days logged`}
      />
      <SummaryTile
        label="Days logged"
        value={`${comparison.daysLogged} of ${comparison.range.days}`}
        hint={
          comparison.range.days > 0
            ? `${Math.round((comparison.daysLogged / comparison.range.days) * 100)}% of the range`
            : ''
        }
      />
      <SummaryTile
        label="Calories vs target"
        value={comparison.adherence ? `${comparison.adherence.calories}%` : '—'}
        hint={comparison.adherence ? 'of the target for this range' : 'No goal set for this range'}
      />
    </div>
  );
}

function SummaryTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-subtle">{hint}</p>
    </div>
  );
}

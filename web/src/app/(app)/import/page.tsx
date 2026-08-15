'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, todayKey } from '@/lib/format';
import { Alert, Badge, Button, EmptyState, Input, Select, cx } from '@/components/ui';
import { MEAL_LABELS, MEAL_TYPES, type ImportDraftRow, type ImportPreview, type MealType } from '@/lib/types';

const ACCEPT = 'application/pdf';

type Step = 'upload' | 'extract' | 'review' | 'import';

export default function ImportPage() {
  const today = todayKey();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<ImportDraftRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const status = useAsync(() => api.imports.status(), []);
  const deepAvailable = status.data?.deepAnalyseAvailable ?? false;

  const step: Step = isSaving
    ? 'import'
    : preview
      ? 'review'
      : isParsing || file
        ? 'extract'
        : 'upload';

  async function parse(nextFile: File, mode: 'script' | 'gemini') {
    setIsParsing(true);
    setError(null);
    setSavedCount(null);

    try {
      const result = await api.imports.parse(nextFile, today, mode);
      setPreview(result);
      setRows(result.rows);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsParsing(false);
    }
  }

  function takeFile(next: File | null) {
    if (!next) return;

    if (next.type !== ACCEPT && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Choose a PDF file.');
      return;
    }

    setFile(next);
    setPreview(null);
    setRows([]);
    void parse(next, 'script');
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setRows([]);
    setError(null);
    setSavedCount(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }

  async function save() {
    if (rows.length === 0) return;

    setIsSaving(true);
    setError(null);

    try {
      const result = await api.imports.commit({ today, rows });
      setSavedCount(result.imported);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }

  function updateRow(index: number, patch: Partial<ImportDraftRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setSavedCount(null);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index));
    setSavedCount(null);
  }

  const totalCalories = rows.reduce((sum, row) => sum + (Number(row.calories) || 0), 0);
  const uniqueDays = new Set(rows.map((row) => row.consumedOn)).size;
  const uniqueFoods = new Set(rows.map((row) => row.foodName.trim().toLowerCase()).filter(Boolean)).size;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Bulk import</h1>
        <p className="text-sm text-muted">
          Upload a food diary, nutrition report or meal history and let the app structure it.
        </p>
      </header>

      {error && <Alert>{error}</Alert>}

      {savedCount !== null && (
        <Alert tone="info">
          Saved {savedCount} {savedCount === 1 ? 'meal' : 'meals'} to your diary.{' '}
          <Link href="/entries" className="underline">
            Open entries
          </Link>
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(13rem,14rem)_minmax(0,1fr)]">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
          <label
            htmlFor="bulk-import-file"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              takeFile(event.dataTransfer.files[0] ?? null);
            }}
            className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong px-3 py-6 text-center"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <PdfIcon />
            </span>
            <div>
              <p className="text-sm font-medium leading-snug">Drop your PDF here or click to browse</p>
              <p className="mt-1 text-xs text-subtle">PDF up to 10 MB</p>
            </div>
          </label>
          <input
            id="bulk-import-file"
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
          />

          <div>
            <h2 className="mb-3 text-sm font-semibold">Processing</h2>
            <ol className="grid grid-cols-4 gap-1">
              <StepPill n={1} label="Uploading" state={stepState(step, 'upload')} />
              <StepPill n={2} label="Extracting" state={stepState(step, 'extract')} />
              <StepPill n={3} label="Reviewing" state={stepState(step, 'review')} />
              <StepPill n={4} label="Importing" state={stepState(step, 'import')} />
            </ol>
          </div>

          {file && (
            <div className="rounded-xl bg-surface-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {isParsing
                      ? 'Extracting the diary…'
                      : preview
                        ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} ready to review`
                        : 'Waiting to extract'}
                  </p>
                </div>
                <Badge tone={preview?.method === 'gemini' ? 'accent' : 'neutral'}>
                  {isParsing ? 'Working' : preview?.method === 'gemini' ? 'Gemini' : 'Script'}
                </Badge>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={cx(
                    'h-full rounded-full bg-accent transition-all',
                    isParsing ? 'w-2/3 animate-pulse' : preview ? 'w-full' : 'w-1/4',
                  )}
                />
              </div>
              {preview && (
                <p className="mt-3 text-xs text-muted">
                  {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                  {uniqueDays > 0 && ` · ${uniqueDays} ${uniqueDays === 1 ? 'day' : 'days'} of data`}
                  {uniqueFoods > 0 && ` · ${uniqueFoods} unique ${uniqueFoods === 1 ? 'food' : 'foods'}`}
                  {preview.pageCount > 0 &&
                    ` · ${preview.pageCount} ${preview.pageCount === 1 ? 'page' : 'pages'}`}
                </p>
              )}
            </div>
          )}

          {file && deepAvailable && (
            <Button
              type="button"
              variant="secondary"
              className="w-full px-3 text-xs"
              onClick={() => void parse(file, 'gemini')}
              isLoading={isParsing}
              disabled={isParsing}
            >
              Not satisfied? Deep Analyse
            </Button>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-[0_1px_2px_rgb(17_17_19/0.04)]">
          <header>
            <h2 className="text-sm font-semibold">Review & confirm</h2>
            <p className="mt-0.5 text-xs text-subtle">
              {preview
                ? 'Check these entries before they are saved. Macros stay editable because every diary row needs them.'
                : 'Extracted meals will appear here.'}
            </p>
          </header>

          {!preview ? (
            <EmptyState
              title="Nothing to review yet"
              description="Drop a PDF on the left. A local script fills this table first."
            />
          ) : (
            <>
              {preview.warnings.map((warning) => (
                <Alert key={warning} tone="warning">
                  {warning}
                </Alert>
              ))}

              {rows.length === 0 ? (
                <EmptyState
                  title="No meals in the preview"
                  description="The script could not map this file. If Deep Analyse is available, try that."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[8rem]" />
                      <col className="w-[6.5rem]" />
                      <col />
                      <col className="w-[3.5rem]" />
                      <col className="w-[3.5rem]" />
                      <col className="w-[3.75rem]" />
                      <col className="w-[3.25rem]" />
                      <col className="w-[3.25rem]" />
                      <col className="w-[3.25rem]" />
                      <col className="w-[2.5rem]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] font-semibold text-subtle">
                        <th className="px-1.5 py-2">Date</th>
                        <th className="px-1.5 py-2">Meal</th>
                        <th className="px-1.5 py-2">Food</th>
                        <th className="px-1.5 py-2 text-right">Qty</th>
                        <th className="px-1.5 py-2">Unit</th>
                        <th className="px-1.5 py-2 text-right">Cal</th>
                        <th className="px-1.5 py-2 text-right">P</th>
                        <th className="px-1.5 py-2 text-right">C</th>
                        <th className="px-1.5 py-2 text-right">F</th>
                        <th className="px-1.5 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${row.foodName}-${index}`} className="border-b border-border/70">
                          <td className="px-1 py-1">
                            <Input
                              type="date"
                              className="px-1.5 py-1 text-xs"
                              value={row.consumedOn}
                              onChange={(event) => updateRow(index, { consumedOn: event.target.value })}
                            />
                          </td>
                          <td className="px-1 py-1">
                            <Select
                              className="px-1.5 py-1 text-xs"
                              value={row.mealType}
                              onChange={(event) =>
                                updateRow(index, { mealType: event.target.value as MealType })
                              }
                            >
                              {MEAL_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {MEAL_LABELS[type]}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-1 py-1">
                            <Input
                              className="px-1.5 py-1 text-xs"
                              title={row.foodName}
                              value={row.foodName}
                              onChange={(event) => updateRow(index, { foodName: event.target.value })}
                            />
                          </td>
                          <NumberCell
                            value={row.quantity}
                            onChange={(quantity) => updateRow(index, { quantity })}
                          />
                          <td className="px-1 py-1">
                            <Input
                              className="px-1.5 py-1 text-xs"
                              value={row.unit}
                              onChange={(event) => updateRow(index, { unit: event.target.value })}
                            />
                          </td>
                          <NumberCell
                            value={row.calories}
                            onChange={(calories) => updateRow(index, { calories })}
                          />
                          <NumberCell
                            value={row.proteinGrams}
                            onChange={(proteinGrams) => updateRow(index, { proteinGrams })}
                          />
                          <NumberCell
                            value={row.carbGrams}
                            onChange={(carbGrams) => updateRow(index, { carbGrams })}
                          />
                          <NumberCell
                            value={row.fatGrams}
                            onChange={(fatGrams) => updateRow(index, { fatGrams })}
                          />
                          <td className="px-1 py-1">
                            <Button
                              variant="ghost"
                              aria-label={`Remove ${row.foodName || 'entry'}`}
                              className="w-full px-1 py-1 text-base leading-none text-muted hover:text-danger"
                              onClick={() => removeRow(index)}
                            >
                              ×
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · {formatCalories(totalCalories)}{' '}
                  kcal
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={reset}>
                    Back
                  </Button>
                  <Button onClick={() => void save()} isLoading={isSaving} disabled={rows.length === 0}>
                    Import {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function stepState(current: Step, target: Step): 'done' | 'active' | 'pending' {
  const order: Step[] = ['upload', 'extract', 'review', 'import'];
  const here = order.indexOf(current);
  const there = order.indexOf(target);

  if (there < here) return 'done';
  if (there === here) return 'active';
  return 'pending';
}

function StepPill({ n, label, state }: { n: number; label: string; state: 'done' | 'active' | 'pending' }) {
  return (
    <li className="flex flex-col items-center gap-1.5 text-center">
      <span
        className={cx(
          'flex size-7 items-center justify-center rounded-full text-xs font-semibold',
          state === 'pending' ? 'bg-surface-raised text-subtle' : 'bg-accent text-on-accent',
        )}
      >
        {n}
      </span>
      <span className={cx('text-[10px] leading-tight', state === 'pending' ? 'text-subtle' : 'font-medium text-foreground')}>
        {label}
      </span>
    </li>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <td className="px-1 py-1">
      <Input
        type="number"
        min={0}
        step="any"
        className="appearance-none px-1 py-1 text-right text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </td>
  );
}

function PdfIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  );
}

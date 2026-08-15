'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, todayKey } from '@/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Input, Select } from '@/components/ui';
import { MEAL_LABELS, MEAL_TYPES, type ImportDraftRow, type ImportPreview, type MealType } from '@/lib/types';

const ACCEPT = 'application/pdf';

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
    void parse(next, 'script');
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

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Import PDF</h1>
          <p className="text-sm text-muted">
            Upload a food diary. A local script fills the table first; Deep Analyse asks Gemini only
            if that reading is wrong.
          </p>
        </div>
        <Link href="/entries">
          <Button variant="secondary">See entries</Button>
        </Link>
      </header>

      {error && <Alert>{error}</Alert>}

      {savedCount !== null && (
        <Alert tone="info">
          Saved {savedCount} {savedCount === 1 ? 'meal' : 'meals'} to your diary. They now count
          toward Today, Entries and Reports.{' '}
          <Link href="/entries" className="underline">
            Open entries
          </Link>
        </Alert>
      )}

      <Card
        title="Diary file"
        description={file ? file.name : 'PDF, up to 10 MB. Tables, CSV dumps and simple lists all work.'}
      >
        <div
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-raised px-6 py-8 text-center"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            takeFile(event.dataTransfer.files[0] ?? null);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          <p className="text-sm">{isParsing ? 'Reading the PDF…' : file ? file.name : 'Drop a PDF here, or click to choose one'}</p>
          <p className="text-xs text-subtle">
            The first pass never calls an LLM. Deep Analyse is a separate click.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => takeFile(event.target.files?.[0] ?? null)}
          />
        </div>
      </Card>

      {preview && (
        <Card
          title="Preview"
          description={
            preview.notes ??
            (rows.length === 0
              ? 'Nothing mapped yet'
              : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${formatCalories(totalCalories)} kcal`)
          }
          action={
            file && (
              <Button
                variant="secondary"
                onClick={() => void parse(file, 'gemini')}
                isLoading={isParsing}
                disabled={isParsing || !deepAvailable}
                title={
                  deepAvailable
                    ? 'Send the PDF to Gemini and replace this table'
                    : 'Add GEMINI_API_KEY on the server to enable Deep Analyse'
                }
              >
                Not satisfied? Deep Analyse
              </Button>
            )
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
            <Badge tone={preview.method === 'gemini' ? 'accent' : 'neutral'}>
              {preview.method === 'gemini' ? 'Gemini' : 'Script'}
            </Badge>
            {preview.schema && <span>Mapped as {preview.schema}</span>}
            <span>
              {preview.pageCount} {preview.pageCount === 1 ? 'page' : 'pages'}
            </span>
            {!deepAvailable && (
              <span>Deep Analyse is off until a Gemini key is set on the server.</span>
            )}
          </div>

          {preview.warnings.map((warning) => (
            <Alert key={warning} tone="warning">
              {warning}
            </Alert>
          ))}

          {rows.length === 0 ? (
            <EmptyState
              title="No meals in the preview"
              description="The script could not map this file. If Deep Analyse is available, try that — Gemini reads scans and unusual column names."
            />
          ) : (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-foreground text-left text-[11px] font-semibold tracking-wide text-surface">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Meal</th>
                      <th className="px-2 py-2">Food</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2">Unit</th>
                      <th className="px-2 py-2 text-right">kcal</th>
                      <th className="px-2 py-2 text-right">P</th>
                      <th className="px-2 py-2 text-right">C</th>
                      <th className="px-2 py-2 text-right">F</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        key={`${row.foodName}-${index}`}
                        className={index % 2 === 1 ? 'bg-surface-raised' : undefined}
                      >
                        <td className="px-1 py-1">
                          <Input
                            type="date"
                            className="min-w-[9.5rem] px-2 py-1 text-xs"
                            value={row.consumedOn}
                            onChange={(event) => updateRow(index, { consumedOn: event.target.value })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <Select
                            className="min-w-[7.5rem] px-2 py-1 text-xs"
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
                            className="min-w-[12rem] px-2 py-1 text-xs"
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
                            className="w-20 px-2 py-1 text-xs"
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
                            className="px-2 py-1 text-xs hover:text-danger"
                            onClick={() => removeRow(index)}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {rows.length} {rows.length === 1 ? 'meal' : 'meals'} · {formatCalories(totalCalories)}{' '}
                  kcal
                </p>
                <Button onClick={() => void save()} isLoading={isSaving} disabled={rows.length === 0}>
                  Save to diary
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function NumberCell({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <td className="px-1 py-1">
      <Input
        type="number"
        min={0}
        step="any"
        className="w-20 px-2 py-1 text-right text-xs tabular-nums"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </td>
  );
}

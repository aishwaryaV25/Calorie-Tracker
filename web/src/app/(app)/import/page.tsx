'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { api } from '@/lib/api-client';
import { errorMessage } from '@/lib/auth-context';
import { useAsync } from '@/hooks/useAsync';
import { formatCalories, todayKey } from '@/lib/format';
import { Alert, Button, EmptyState } from '@/components/ui';
import { ImportDraftList } from '@/components/import/ImportDraftList';
import { ImportDrop, ImportFileRail } from '@/components/import/ImportDrop';
import { ImportPromo } from '@/components/import/ImportPromo';
import { useAuth } from '@/lib/auth-context';
import type { ImportDraftRow, ImportPreview } from '@/lib/types';

const ACCEPT = 'application/pdf';

export default function ImportPage() {
  const today = todayKey();
  const { user } = useAuth();
  const firstName = user?.displayName.trim().split(/\s+/)[0] ?? '';
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

  const summary = isParsing
    ? 'Extracting the diary…'
    : preview
      ? [
          `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
          uniqueDays > 0 ? `${uniqueDays} ${uniqueDays === 1 ? 'day' : 'days'}` : null,
          uniqueFoods > 0 ? `${uniqueFoods} unique ${uniqueFoods === 1 ? 'food' : 'foods'}` : null,
          preview.pageCount > 0
            ? `${preview.pageCount} ${preview.pageCount === 1 ? 'page' : 'pages'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : 'Waiting to extract';

  const reviewing = Boolean(file && preview);

  return (
    <div className={reviewing ? 'flex flex-col gap-4' : 'flex flex-col gap-5'}>
      <header className={reviewing ? 'flex flex-wrap items-end justify-between gap-3' : undefined}>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">Tools</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bulk import</h1>
          {!reviewing && (
            <p className="mt-1 text-sm text-muted">
              Upload a food diary, nutrition report or meal history and let the app structure it.
            </p>
          )}
        </div>
        {reviewing && (
          <p className="text-sm text-muted">
            Check the table, then commit. Repeats are written as new rows.
          </p>
        )}
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

      {!file ? (
        <>
          <ImportDrop inputRef={inputRef} isParsing={isParsing} onFile={takeFile} />
          <ImportPromo firstName={firstName} />
        </>
      ) : (
        <>
          <ImportFileRail
            fileName={file.name}
            isParsing={isParsing}
            method={preview?.method ?? null}
            summary={summary}
            deepAvailable={deepAvailable}
            onDeepAnalyse={() => void parse(file, 'gemini')}
            onReset={reset}
          />

          {!preview ? (
            <EmptyState
              title="Reading the file"
              description="Extracted meals will land here as a table you can edit before anything is saved."
            />
          ) : (
            <section className="flex flex-col gap-4">
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
                <ImportDraftList rows={rows} onChange={updateRow} onRemove={removeRow} />
              )}

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 px-5 py-4 shadow-[0_8px_24px_rgb(17_17_19/0.08)] backdrop-blur">
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
            </section>
          )}
        </>
      )}
    </div>
  );
}

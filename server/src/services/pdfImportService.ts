import { extractText, getDocumentProxy } from 'unpdf';
import { MEAL_TYPES, type MealType } from '../domain/nutrition.js';
import { generateGeminiJson, isGeminiConfigured } from '../lib/gemini-client.js';
import { badRequest, unprocessable } from '../lib/errors.js';
import type { CreateEntryInput } from '../types/dto.js';
import * as entriesService from './entriesService.js';
import {
  MAX_IMPORT_ROWS,
  parseDiaryText,
  type ImportDraftRow,
} from './pdfImportParser.js';

export type { ImportDraftRow };

/**
 * Bulk import of a food diary from a PDF.
 *
 * Two passes, in this order, because an LLM call is slower and metered:
 *
 *   1. Script — extract the text, try the table shapes a diary usually has.
 *   2. Gemini — only when the user asks. The PDF itself is sent, so a scan or
 *      a renamed-column export that the script missed can still be read.
 *
 * Nothing is written until `commitImport`. The preview is a draft the user
 * edits; saving it is what creates the entries, which then show up in Today,
 * Entries and Reports like anything else logged by hand.
 */

export type ImportMethod = 'script' | 'gemini';

export interface ImportPreview {
  method: ImportMethod;
  rows: ImportDraftRow[];
  warnings: string[];
  notes: string | null;
  headerGuess: string[] | null;
  schema: string | null;
  pageCount: number;
  deepAnalyseAvailable: boolean;
}

export interface ImportCommitResult {
  imported: number;
}

const MAX_EXTRACTED_CHARS = 40_000;
const MAX_GEMINI_TOKENS = 8_192;

export function importStatus() {
  return { deepAnalyseAvailable: isGeminiConfigured() };
}

export async function previewImport(
  file: Buffer,
  today: string,
  method: ImportMethod,
): Promise<ImportPreview> {
  const extracted = await readPdfText(file);

  if (method === 'gemini') {
    return previewWithGemini(file, extracted, today);
  }

  const parsed = parseDiaryText(extracted.text, today);

  return {
    method: 'script',
    rows: parsed.rows,
    warnings: parsed.warnings,
    notes: parsed.notes,
    headerGuess: parsed.headerGuess,
    schema: parsed.schema,
    pageCount: extracted.pageCount,
    deepAnalyseAvailable: isGeminiConfigured(),
  };
}

export async function commitImport(
  userId: string,
  rows: ImportDraftRow[],
  today: string,
): Promise<ImportCommitResult> {
  if (rows.length === 0) {
    throw badRequest('There is nothing to save. Add a row, or parse a PDF first.');
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw badRequest(`Import at most ${MAX_IMPORT_ROWS} rows at a time.`);
  }

  const inputs = rows.map((row) => toCreateInput(row, today));
  const created = await entriesService.createEntries(userId, inputs, 'pdf');

  return { imported: created.length };
}

async function readPdfText(file: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(file));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const joined = Array.isArray(text) ? text.join('\n') : text;

    return { text: joined, pageCount: totalPages };
  } catch {
    throw unprocessable(
      'This file could not be read as a PDF. It may be corrupt, password-protected, or not a PDF at all.',
    );
  }
}

async function previewWithGemini(
  file: Buffer,
  extracted: { text: string; pageCount: number },
  today: string,
): Promise<ImportPreview> {
  const excerpt =
    extracted.text.trim().length > 0
      ? extracted.text.slice(0, MAX_EXTRACTED_CHARS)
      : '(no selectable text — the file is likely a scan)';

  const raw = await generateGeminiJson({
    maxTokens: MAX_GEMINI_TOKENS,
    rejectionMessage:
      'Gemini could not read this PDF. It may be corrupt, too large, or in a format the model does not support.',
    parts: [
      { inline_data: { mime_type: 'application/pdf', data: file.toString('base64') } },
      {
        text: `You are reading a personal food diary exported as a PDF. Today is ${today}.

Extract every food or drink the person ate. Ignore titles, page numbers, goals, totals, charts and advice.

Return a JSON object: { "rows": [...], "notes": string|null, "warnings": string[] }

Each row:
- foodName (string, required)
- mealType: one of ${MEAL_TYPES.join(', ')}. Infer from the food, a heading, or the time when unsaid.
- quantity (number > 0, default 1)
- unit (string, default "serving")
- calories (number >= 0). Estimate from the food and portion when the PDF has no number. Never leave this null.
- proteinGrams, carbGrams, fatGrams (numbers >= 0, default 0)
- consumedOn (YYYY-MM-DD). Use dates written in the PDF; resolve "today"/"yesterday" against ${today}; if a row has no date, use ${today}.
- consumedAt (optional ISO date-time) only when a clock time is written.

Do not invent meals that are not in the document. If nothing looks like a diary, return { "rows": [], "notes": null, "warnings": ["No food entries found."] }.

Selectable text already extracted from the file, which may help when the layout is a table:

${excerpt}`,
      },
    ],
  });

  let parsed: { rows?: unknown; notes?: unknown; warnings?: unknown };

  try {
    parsed = JSON.parse(raw) as { rows?: unknown; notes?: unknown; warnings?: unknown };
  } catch {
    throw unprocessable('Gemini returned a reply that was not valid JSON. Try Deep Analyse again.');
  }

  const rows = Array.isArray(parsed.rows)
    ? parsed.rows
        .map((row) => sanitiseGeminiRow(row, today))
        .filter((row): row is ImportDraftRow => row !== null)
        .slice(0, MAX_IMPORT_ROWS)
    : [];

  const warnings = Array.isArray(parsed.warnings)
    ? parsed.warnings.filter((item): item is string => typeof item === 'string').slice(0, 8)
    : [];

  if (rows.length === 0 && warnings.length === 0) {
    warnings.push('Gemini did not find any meals in this PDF.');
  }

  return {
    method: 'gemini',
    rows,
    warnings,
    notes: typeof parsed.notes === 'string' ? parsed.notes : `Read ${rows.length} rows with Gemini.`,
    headerGuess: null,
    schema: 'gemini',
    pageCount: extracted.pageCount,
    deepAnalyseAvailable: true,
  };
}

function sanitiseGeminiRow(value: unknown, today: string): ImportDraftRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const foodName = typeof row.foodName === 'string' ? row.foodName.trim() : '';
  const calories = asAmount(row.calories);

  if (!foodName || calories === undefined) {
    return null;
  }

  const mealType = MEAL_TYPES.includes(row.mealType as MealType)
    ? (row.mealType as MealType)
    : 'snack';

  const consumedOn =
    typeof row.consumedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.consumedOn)
      ? row.consumedOn
      : today;

  const quantity = asAmount(row.quantity);
  const draft: ImportDraftRow = {
    foodName: foodName.slice(0, 160),
    mealType,
    quantity: quantity && quantity > 0 ? Math.min(quantity, 10_000) : 1,
    unit: typeof row.unit === 'string' && row.unit.trim() ? row.unit.trim().slice(0, 24) : 'serving',
    calories: Math.min(Math.max(calories, 0), 100_000),
    proteinGrams: clampAmount(asAmount(row.proteinGrams) ?? 0),
    carbGrams: clampAmount(asAmount(row.carbGrams) ?? 0),
    fatGrams: clampAmount(asAmount(row.fatGrams) ?? 0),
    consumedOn,
  };

  if (typeof row.consumedAt === 'string' && !Number.isNaN(Date.parse(row.consumedAt))) {
    draft.consumedAt = new Date(row.consumedAt).toISOString();
  }

  return draft;
}

function toCreateInput(row: ImportDraftRow, today: string): CreateEntryInput {
  const consumedOn = row.consumedOn || today;

  return {
    foodName: row.foodName.trim(),
    mealType: row.mealType,
    quantity: row.quantity,
    unit: row.unit,
    calories: row.calories,
    proteinGrams: row.proteinGrams,
    carbGrams: row.carbGrams,
    fatGrams: row.fatGrams,
    consumedOn,
    consumedAt: row.consumedAt ? new Date(row.consumedAt) : new Date(`${consumedOn}T12:00:00.000Z`),
  };
}

const asAmount = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

const clampAmount = (value: number) => Math.min(Math.max(value, 0), 100_000);

import { config } from '../config.js';
import { MEAL_TYPES, type MealType } from '../domain/nutrition.js';
import { createCompletion, parseJsonContent } from '../lib/ai-client.js';
import { badRequest } from '../lib/errors.js';
import * as aiExtractService from './aiExtractService.js';
import type { ExtractionResult } from './aiExtractService.js';
import { createPending, type PendingAction, type PendingOutcome } from './chatPending.js';
import type { ChatAction } from './chatTypes.js';
import * as entriesService from './entriesService.js';
import type { ImportDraftRow } from './pdfImportParser.js';
import * as pdfImportService from './pdfImportService.js';

const LOG_IT =
  /\b(log (it|them|this|these)|import (it|them|this|these)|save (it|them|this|these)|looks good|that'?s fine|go ahead|confirm|yes,? log)\b/i;
const CANCEL = /^(no|n|cancel|stop|forget it|don't)$/i;

const COLUMNS: Record<string, keyof ImportDraftRow> = {
  food: 'foodName',
  name: 'foodName',
  meal: 'mealType',
  type: 'mealType',
  calories: 'calories',
  calorie: 'calories',
  kcal: 'calories',
  protein: 'proteinGrams',
  carbs: 'carbGrams',
  carb: 'carbGrams',
  carbohydrate: 'carbGrams',
  fat: 'fatGrams',
  quantity: 'quantity',
  qty: 'quantity',
  amount: 'quantity',
  unit: 'unit',
  date: 'consumedOn',
};

export async function previewAttachment(
  file: Buffer,
  mimeType: string,
  today: string,
): Promise<{ reply: string; pendingAction: PendingAction }> {
  if (mimeType === 'application/pdf') {
    let preview = await pdfImportService.previewImport(file, today, 'script');

    if (preview.rows.length === 0 && pdfImportService.importStatus().deepAnalyseAvailable) {
      preview = await pdfImportService.previewImport(file, today, 'gemini');
    }

    if (preview.rows.length === 0) {
      throw badRequest(
        preview.notes ||
          'I could not read any diary rows from that PDF. Try the Bulk import page if you want a deep analyse.',
      );
    }

    const pending = createPending('review_import', 'pdf import', []);
    pending.importRows = preview.rows;

    const extra = preview.warnings.length > 0 ? `\n\n${preview.warnings.slice(0, 3).join('\n')}` : '';
    const how = preview.method === 'gemini' ? ' after a deeper read' : '';

    return {
      reply: `I read ${preview.rows.length} ${preview.rows.length === 1 ? 'row' : 'rows'} from the PDF${how}. Nothing is saved yet.\n\n${formatImportTable(preview.rows)}\n\nTell me a row and column to change, or say when to log these.${extra}`,
      pendingAction: pending,
    };
  }

  if (!mimeType.startsWith('image/')) {
    throw badRequest('Attach a photo (JPEG, PNG or WebP) or a PDF diary.');
  }

  const extraction = await aiExtractService.extractNutritionFromImage(file, mimeType);
  const pending = createPending('confirm_extract', 'photo extract', []);
  pending.extract = extraction;

  return {
    reply: `${formatExtraction(extraction)}\n\nTell me what to change, or say when to log it.`,
    pendingAction: pending,
  };
}

export async function applyAttachPending(
  userId: string,
  pending: PendingAction,
  text: string,
  today: string,
  choice?: { confirm?: boolean },
): Promise<PendingOutcome & { unhandled?: boolean }> {
  if (CANCEL.test(text.trim()) || choice?.confirm === false) {
    return { reply: 'Okay, I discarded that draft. Nothing was saved.', actions: [], pendingAction: null };
  }

  if (pending.kind === 'confirm_extract' && pending.extract) {
    return applyExtractPending(userId, pending, text, today, choice);
  }

  if (pending.kind === 'review_import' && pending.importRows) {
    return applyImportPending(userId, pending, text, today, choice);
  }

  return { reply: '', actions: [], pendingAction: pending, unhandled: true };
}

async function applyExtractPending(
  userId: string,
  pending: PendingAction,
  text: string,
  today: string,
  choice?: { confirm?: boolean },
): Promise<PendingOutcome & { unhandled?: boolean }> {
  const extraction = pending.extract!;

  if (choice?.confirm === true || LOG_IT.test(text) || /^(yes|y|ok|okay)$/i.test(text.trim())) {
    const mealType = extraction.suggestedMealType ?? 'lunch';
    const entry = await entriesService.createEntry(
      userId,
      {
        foodName: extraction.entry.foodName,
        mealType,
        quantity: extraction.entry.quantity,
        unit: extraction.entry.unit,
        calories: extraction.entry.calories,
        proteinGrams: extraction.entry.proteinGrams,
        carbGrams: extraction.entry.carbGrams,
        fatGrams: extraction.entry.fatGrams,
        consumedOn: today,
        micronutrients: extraction.entry.micronutrients.map((item) => ({
          nutrient: item.nutrient,
          amount: item.amount,
          unit: item.unit,
        })),
      },
      'image',
    );

    return {
      reply: `Logged ${entry.foodName} as ${entry.mealType} — ${Math.round(entry.calories)} kcal. It is on Today now.`,
      actions: [
        {
          tool: 'log_meal',
          type: 'meal_created',
          label: `Logged ${entry.foodName} from a photo — ${Math.round(entry.calories)} kcal`,
          entryId: entry.id,
        },
      ],
      pendingAction: null,
    };
  }

  const edited = editExtraction(extraction, text);
  if (!edited) {
    return { reply: '', actions: [], pendingAction: pending, unhandled: true };
  }

  const next = createPending('confirm_extract', pending.originalRequest, []);
  next.extract = edited;

  return {
    reply: `Updated draft:\n\n${formatExtraction(edited)}\n\nAnything else, or shall I log it?`,
    actions: [],
    pendingAction: next,
  };
}

async function applyImportPending(
  userId: string,
  pending: PendingAction,
  text: string,
  today: string,
  choice?: { confirm?: boolean },
): Promise<PendingOutcome & { unhandled?: boolean }> {
  const rows = pending.importRows ?? [];

  if (choice?.confirm === true || LOG_IT.test(text) || /^(yes|y|ok|okay)$/i.test(text.trim())) {
    const result = await pdfImportService.commitImport(userId, rows, today);
    const actions: ChatAction[] = [
      {
        tool: 'import_commit',
        type: 'meal_created',
        label: `Imported ${result.imported} ${result.imported === 1 ? 'meal' : 'meals'} from a PDF`,
      },
    ];

    return {
      reply: `Saved ${result.imported} ${result.imported === 1 ? 'meal' : 'meals'} from the PDF. They are in your diary now.`,
      actions,
      pendingAction: null,
    };
  }

  const edited = editImportRows(rows, text);
  if (edited.status === 'none') {
    return { reply: '', actions: [], pendingAction: pending, unhandled: true };
  }

  if (edited.status === 'ambiguous') {
    return {
      reply: `${edited.message}\n\n${formatImportTable(rows)}`,
      actions: [],
      pendingAction: pending,
    };
  }

  const next = createPending('review_import', pending.originalRequest, []);
  next.importRows = edited.rows;

  return {
    reply: `Updated draft:\n\n${formatImportTable(edited.rows)}\n\nAnything else to change, or shall I log these?`,
    actions: [],
    pendingAction: next,
  };
}

export function formatImportTable(rows: ImportDraftRow[]): string {
  const header = ['#', 'Meal', 'Food', 'Qty', 'Unit', 'kcal', 'P', 'C', 'F', 'Date'];
  const body = rows.map((row, index) => [
    String(index + 1),
    row.mealType,
    row.foodName,
    String(row.quantity),
    row.unit,
    String(Math.round(row.calories)),
    String(Math.round(row.proteinGrams)),
    String(Math.round(row.carbGrams)),
    String(Math.round(row.fatGrams)),
    row.consumedOn,
  ]);

  return formatTextTable([header, ...body]);
}

export function formatExtraction(result: ExtractionResult): string {
  const meal = result.suggestedMealType ?? 'unspecified meal';
  const { entry } = result;
  const lines = [
    `I read this as a ${result.source === 'nutrition_label' ? 'nutrition label' : 'meal photo'} (${result.confidence} confidence).`,
    '',
    `Food: ${entry.foodName}`,
    `Meal: ${meal}`,
    `Portion: ${entry.quantity} ${entry.unit}`,
    `Calories: ${Math.round(entry.calories)}   Protein: ${Math.round(entry.proteinGrams)}g   Carbs: ${Math.round(entry.carbGrams)}g   Fat: ${Math.round(entry.fatGrams)}g`,
  ];

  if (result.components.length > 0) {
    lines.push('', 'On the plate (not saved as separate rows unless you ask):');
    for (const item of result.components) {
      lines.push(`- ${item.name} — ${item.quantity} ${item.unit} — ${Math.round(item.calories)} kcal`);
    }
  }

  if (result.warnings[0]) {
    lines.push('', result.warnings[0]);
  }

  return lines.join('\n');
}

export function formatTextTable(rows: string[][]): string {
  if (rows.length === 0) {
    return '';
  }

  const header = rows[0] ?? [];
  const widths = header.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? '').length)));

  return rows
    .map((row) => row.map((cell, column) => (cell ?? '').padEnd(widths[column] ?? 0)).join('  '))
    .join('\n');
}

export function editImportRows(
  rows: ImportDraftRow[],
  text: string,
):
  | { status: 'ok'; rows: ImportDraftRow[] }
  | { status: 'none' }
  | { status: 'ambiguous'; message: string } {
  const parsed = parseEdit(text);

  if (!parsed) {
    return { status: 'none' };
  }

  let matches = rows.map((row, index) => ({ row, index }));

  if (parsed.rowIndex !== undefined) {
    const found = matches.find((item) => item.index === parsed.rowIndex! - 1);
    matches = found ? [found] : [];
  } else if (parsed.food) {
    const needle = parsed.food.toLowerCase();
    matches = matches.filter((item) => item.row.foodName.toLowerCase().includes(needle));
  }

  if (matches.length === 0) {
    return { status: 'ambiguous', message: 'I could not find that row. Use the row number or the food name.' };
  }

  const first = matches[0];
  if (!first) {
    return { status: 'ambiguous', message: 'I could not find that row. Use the row number or the food name.' };
  }

  if (matches.length > 1 && parsed.rowIndex === undefined) {
    return {
      status: 'ambiguous',
      message: `Several rows match. Say the row number, for example "row ${first.index + 1} ${parsed.field} ${String(parsed.value)}".`,
    };
  }

  const next = rows.map((row) => ({ ...row }));
  const target = next[first.index];
  if (!target) {
    return { status: 'ambiguous', message: 'I could not find that row. Use the row number or the food name.' };
  }
  applyField(target, parsed.field, parsed.value);

  return { status: 'ok', rows: next };
}

function editExtraction(result: ExtractionResult, text: string): ExtractionResult | null {
  const parsed = parseEdit(text);

  if (!parsed) {
    const meal = MEAL_TYPES.find((type) => new RegExp(`\\b${type}\\b`, 'i').test(text));
    if (meal) {
      return { ...result, suggestedMealType: meal };
    }
    return null;
  }

  const entry = { ...result.entry };
  if (parsed.field === 'foodName' && typeof parsed.value === 'string') {
    entry.foodName = parsed.value;
  } else if (parsed.field === 'mealType' && typeof parsed.value === 'string') {
    return { ...result, suggestedMealType: parsed.value as MealType, entry };
  } else if (parsed.field !== 'consumedOn' && parsed.field !== 'consumedAt' && typeof parsed.value === 'number') {
    (entry as unknown as Record<string, number>)[parsed.field] = parsed.value;
  } else if (parsed.field === 'unit' && typeof parsed.value === 'string') {
    entry.unit = parsed.value;
  } else {
    return null;
  }

  return { ...result, entry };
}

function parseEdit(text: string): { rowIndex?: number; food?: string; field: keyof ImportDraftRow; value: string | number } | null {
  const normalised = text.trim();
  const rowMatch = normalised.match(/\brow\s*(\d+)\b/i);
  const rowIndex = rowMatch ? Number(rowMatch[1]) : undefined;

  const columnMatch = normalised.match(
    /\b(food|name|meal|type|calories|calorie|kcal|protein|carbs?|carbohydrate|fat|quantity|qty|amount|unit|date)\b/i,
  );

  if (!columnMatch) {
    return null;
  }

  const columnName = columnMatch[1]?.toLowerCase();
  if (!columnName) {
    return null;
  }

  const field = COLUMNS[columnName];
  if (!field) {
    return null;
  }

  const after = normalised.slice(normalised.toLowerCase().indexOf(columnName) + columnName.length);
  const number = after.match(/(-?\d+(?:\.\d+)?)/);
  const word = after.match(/\bto\s+([a-z][a-z0-9 \-]{0,40})/i);

  let value: string | number | undefined;
  if (field === 'foodName' || field === 'unit' || field === 'mealType' || field === 'consumedOn') {
    value = word?.[1]?.trim() ?? after.replace(/^[=\s:to-]+/i, '').trim();
    if (field === 'mealType') {
      const meal = MEAL_TYPES.find((type) => value && String(value).toLowerCase().includes(type));
      if (!meal) {
        return null;
      }
      value = meal;
    }
  } else if (number?.[1]) {
    value = Number(number[1]);
  }

  if (value === undefined || value === '') {
    return null;
  }

  const foodMatch = normalised.match(
    /\b(?:change|set|make|update|edit)?\s*(?:the|for|on|in)?\s*([a-z][a-z0-9 ]{1,40}?)\s+(?:calories|kcal|protein|carbs?|fat|quantity|qty|unit|meal)\b/i,
  );
  const food = !rowIndex && foodMatch?.[1] ? foodMatch[1].replace(/\b(the|a|an|row)\b/gi, '').trim() : undefined;

  return { rowIndex, food: food || undefined, field, value };
}

function applyField(row: ImportDraftRow, field: keyof ImportDraftRow, value: string | number) {
  if (field === 'foodName' || field === 'unit' || field === 'consumedOn') {
    row[field] = String(value);
    return;
  }

  if (field === 'mealType') {
    const meal = MEAL_TYPES.find((type) => String(value).toLowerCase() === type);
    if (meal) {
      row.mealType = meal;
    }
    return;
  }

  if (typeof value === 'number') {
    (row[field] as number) = value;
  }
}

export function isAttachPending(pending: PendingAction): boolean {
  return pending.kind === 'confirm_extract' || pending.kind === 'review_import';
}

interface InterpretedAttach {
  action?: string;
  question?: string;
  foodName?: string | null;
  mealType?: string | null;
  quantity?: number | null;
  unit?: string | null;
  calories?: number | null;
  proteinGrams?: number | null;
  carbGrams?: number | null;
  fatGrams?: number | null;
  edits?: { row?: number; field?: string; value?: string | number }[];
}

/**
 * When the user does not name a row and column, the chat model reads the draft
 * JSON (not the file bytes) and says whether they confirmed, cancelled, edited,
 * asked about the draft, or changed the subject.
 */
export async function interpretAttachMessage(
  pending: PendingAction,
  text: string,
  today: string,
  userId: string,
): Promise<PendingOutcome & { unhandled?: boolean }> {
  const completion = await createCompletion({
    messages: [
      { role: 'system', content: interpretPrompt(pending) },
      { role: 'user', content: text },
    ],
    model: config.ai.chatModel,
    jsonSchema: { name: 'attach_intent', schema: INTERPRET_SCHEMA },
    temperature: 0.1,
    maxTokens: 500,
    rejectionMessage: 'I could not tell what to change. Name a row and column, or say when to log it.',
  });

  let parsed: InterpretedAttach;
  try {
    parsed = parseJsonContent<InterpretedAttach>(completion.content);
  } catch {
    return { reply: '', actions: [], pendingAction: pending, unhandled: true };
  }

  const action = String(parsed.action ?? 'other').toLowerCase();

  if (action === 'other') {
    return { reply: '', actions: [], pendingAction: pending, unhandled: true };
  }

  if (action === 'ask') {
    return {
      reply: parsed.question?.trim() || 'Which row and column should I change?',
      actions: [],
      pendingAction: pending,
    };
  }

  if (action === 'confirm') {
    return applyAttachPending(userId, pending, 'log it', today, { confirm: true });
  }

  if (action === 'cancel') {
    return applyAttachPending(userId, pending, 'cancel', today, { confirm: false });
  }

  if (pending.kind === 'confirm_extract' && pending.extract) {
    const edited = applyInterpretedExtract(pending.extract, parsed);
    if (!edited) {
      return { reply: '', actions: [], pendingAction: pending, unhandled: true };
    }

    const next = createPending('confirm_extract', pending.originalRequest, []);
    next.extract = edited;

    return {
      reply: `Updated draft:\n\n${formatExtraction(edited)}\n\nAnything else, or shall I log it?`,
      actions: [],
      pendingAction: next,
    };
  }

  if (pending.kind === 'review_import' && pending.importRows) {
    const edited = applyInterpretedImport(pending.importRows, parsed.edits ?? []);
    if (!edited) {
      return { reply: '', actions: [], pendingAction: pending, unhandled: true };
    }

    const next = createPending('review_import', pending.originalRequest, []);
    next.importRows = edited;

    return {
      reply: `Updated draft:\n\n${formatImportTable(edited)}\n\nAnything else to change, or shall I log these?`,
      actions: [],
      pendingAction: next,
    };
  }

  return { reply: '', actions: [], pendingAction: pending, unhandled: true };
}

function interpretPrompt(pending: PendingAction): string {
  const draft =
    pending.kind === 'review_import'
      ? JSON.stringify(pending.importRows ?? [])
      : JSON.stringify({
          foodName: pending.extract?.entry.foodName,
          mealType: pending.extract?.suggestedMealType,
          quantity: pending.extract?.entry.quantity,
          unit: pending.extract?.entry.unit,
          calories: pending.extract?.entry.calories,
          proteinGrams: pending.extract?.entry.proteinGrams,
          carbGrams: pending.extract?.entry.carbGrams,
          fatGrams: pending.extract?.entry.fatGrams,
        });

  return `The user is reviewing a draft that has not been saved. Here is the draft JSON:\n${draft}\n
Decide what they want. action must be one of:
- confirm: they want the draft saved
- cancel: they want the draft discarded
- edit: they want numbers or names changed
- ask: they asked a question about the draft
- other: the message is not about this draft
For edit on a photo draft, fill the fields that change. For edit on a table, fill edits with 1-based row, field (foodName, mealType, quantity, unit, calories, proteinGrams, carbGrams, fatGrams, consumedOn), and value.
Do not invent rows. Meal types are ${MEAL_TYPES.join(', ')}.`;
}

const INTERPRET_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['confirm', 'cancel', 'edit', 'ask', 'other'] },
    question: { type: 'string' },
    foodName: { type: ['string', 'null'] },
    mealType: { type: ['string', 'null'] },
    quantity: { type: ['number', 'null'] },
    unit: { type: ['string', 'null'] },
    calories: { type: ['number', 'null'] },
    proteinGrams: { type: ['number', 'null'] },
    carbGrams: { type: ['number', 'null'] },
    fatGrams: { type: ['number', 'null'] },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          row: { type: 'integer' },
          field: { type: 'string' },
          value: { type: ['string', 'number'] },
        },
        required: ['row', 'field', 'value'],
      },
    },
  },
  required: [
    'action',
    'question',
    'foodName',
    'mealType',
    'quantity',
    'unit',
    'calories',
    'proteinGrams',
    'carbGrams',
    'fatGrams',
    'edits',
  ],
};

function applyInterpretedExtract(result: ExtractionResult, parsed: InterpretedAttach): ExtractionResult | null {
  const entry = { ...result.entry };
  let changed = false;
  let mealType = result.suggestedMealType;

  if (typeof parsed.foodName === 'string' && parsed.foodName.trim()) {
    entry.foodName = parsed.foodName.trim();
    changed = true;
  }

  if (typeof parsed.unit === 'string' && parsed.unit.trim()) {
    entry.unit = parsed.unit.trim();
    changed = true;
  }

  if (typeof parsed.mealType === 'string') {
    const meal = MEAL_TYPES.find((type) => parsed.mealType?.toLowerCase().includes(type));
    if (meal) {
      mealType = meal;
      changed = true;
    }
  }

  for (const field of ['quantity', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'] as const) {
    const value = parsed[field];
    if (typeof value === 'number' && Number.isFinite(value)) {
      entry[field] = value;
      changed = true;
    }
  }

  return changed ? { ...result, suggestedMealType: mealType, entry } : null;
}

function applyInterpretedImport(
  rows: ImportDraftRow[],
  edits: { row?: number; field?: string; value?: string | number }[],
): ImportDraftRow[] | null {
  if (edits.length === 0) {
    return null;
  }

  const next = rows.map((row) => ({ ...row }));
  let changed = false;

  for (const edit of edits) {
    const index = (edit.row ?? 0) - 1;
    const field = COLUMNS[String(edit.field ?? '').toLowerCase()] ?? (edit.field as keyof ImportDraftRow | undefined);

    const target = next[index];
    if (index < 0 || !target || !field || !(field in target) || edit.value === undefined) {
      continue;
    }

    applyField(target, field, edit.value);
    changed = true;
  }

  return changed ? next : null;
}

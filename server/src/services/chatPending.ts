import type { MealType } from '../domain/nutrition.js';
import type { ExtractionResult } from './aiExtractService.js';
import * as entriesService from './entriesService.js';
import type { ChatAction } from './chatTypes.js';
import { hintFromText, resolveAmong, type EntryRef } from './chatResolve.js';
import type { ImportDraftRow } from './pdfImportParser.js';

export type PendingKind =
  | 'choose_delete'
  | 'choose_update'
  | 'confirm_bulk_delete'
  | 'confirm_extract'
  | 'review_import';

export interface PendingAction {
  kind: PendingKind;
  originalRequest: string;
  candidates: EntryRef[];
  /** Fields to PATCH after the user picks a row. */
  patch?: {
    foodName?: string;
    mealType?: MealType;
    quantity?: number;
    unit?: string;
    calories?: number;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
  };
  /** Photo extract draft. Echoed by the client; never written to the database. */
  extract?: ExtractionResult;
  /** PDF import draft rows. Echoed by the client; nothing is saved until they confirm. */
  importRows?: ImportDraftRow[];
  expiresAt: string;
}

export interface PendingChoice {
  entryId?: string;
  index?: number;
  confirm?: boolean;
}

export interface PendingOutcome {
  reply: string;
  actions: ChatAction[];
  pendingAction: PendingAction | null;
}

const PENDING_TTL_MS = 10 * 60 * 1000;

export function isPendingExpired(pending: PendingAction, now = Date.now()): boolean {
  return Date.parse(pending.expiresAt) <= now;
}

export function createPending(
  kind: PendingKind,
  originalRequest: string,
  candidates: EntryRef[],
  patch?: PendingAction['patch'],
): PendingAction {
  return {
    kind,
    originalRequest,
    candidates,
    patch,
    expiresAt: new Date(Date.now() + PENDING_TTL_MS).toISOString(),
  };
}

export function describePending(pending: PendingAction): string {
  if (pending.kind === 'confirm_extract') {
    return 'I have a photo draft ready. Tell me what to change, or say when to log it.';
  }

  if (pending.kind === 'review_import') {
    return 'I have a PDF draft ready. Tell me a row and column to change, or say when to log these.';
  }

  if (pending.kind === 'confirm_bulk_delete') {
    const day = pending.candidates[0]?.consumedOn ?? 'that day';
    return `That will remove ${pending.candidates.length} meal ${
      pending.candidates.length === 1 ? 'entry' : 'entries'
    } from ${day}. Should I go ahead?`;
  }

  const verb = pending.kind === 'choose_update' ? 'change' : 'remove';
  const lines = pending.candidates.map((entry, index) => formatCandidate(index + 1, entry));

  return `I found ${pending.candidates.length} meals.\n\n${lines.join('\n')}\n\nWhich one should I ${verb}?`;
}

export function formatCandidate(index: number, entry: EntryRef): string {
  const meal = entry.mealType.charAt(0).toUpperCase() + entry.mealType.slice(1);
  return `${index}. ${meal} — ${entry.foodName} — ${entry.quantity} ${entry.unit} — ${Math.round(entry.calories)} kcal`;
}

const YES = /^(yes|y|ok|okay|proceed|confirm|do it|go ahead)$/i;
const NO = /^(no|n|cancel|stop|don't|do not)$/i;

export function looksLikePendingReply(text: string, pending: PendingAction): boolean {
  const trimmed = text.trim();

  if (trimmed.length > 80) {
    return false;
  }

  if (YES.test(trimmed) || NO.test(trimmed)) {
    return true;
  }

  if (/^\d{1,2}$/.test(trimmed)) {
    return true;
  }

  const hint = hintFromText(trimmed);
  if (hint.mealType || hint.search || hint.index) {
    return true;
  }

  return pending.candidates.some((entry) =>
    trimmed.toLowerCase().includes(entry.foodName.toLowerCase()),
  );
}

export async function applyPending(
  userId: string,
  pending: PendingAction,
  text: string,
  choice?: PendingChoice,
): Promise<PendingOutcome> {
  if (isPendingExpired(pending)) {
    return {
      reply: 'That choice expired. Ask me again and I will look the meals up fresh.',
      actions: [],
      pendingAction: null,
    };
  }

  if (pending.kind === 'confirm_bulk_delete') {
    return applyBulk(userId, pending, text, choice);
  }

  const picked = pickCandidate(pending.candidates, text, choice);

  if (picked.status === 'none') {
    return {
      reply: `I could not tell which meal you meant.\n\n${describePending(pending)}`,
      actions: [],
      pendingAction: pending,
    };
  }

  if (picked.status === 'many') {
    const narrowed = createPending(pending.kind, pending.originalRequest, picked.entries, pending.patch);
    return { reply: describePending(narrowed), actions: [], pendingAction: narrowed };
  }

  if (pending.kind === 'choose_update') {
    const entry = await entriesService.updateEntry(userId, picked.entry.entryId, pending.patch ?? {});
    return {
      reply: `Updated ${entry.foodName} — ${Math.round(entry.calories)} kcal, ${entry.mealType} on ${entry.consumedOn}.`,
      actions: [
        {
          tool: 'update_entry',
          type: 'meal_updated',
          label: `Updated ${entry.foodName} — ${Math.round(entry.calories)} kcal`,
          entryId: entry.id,
        },
      ],
      pendingAction: null,
    };
  }

  const entry = await entriesService.getEntry(userId, picked.entry.entryId);
  await entriesService.deleteEntry(userId, picked.entry.entryId);

  return {
    reply: `Removed your ${entry.mealType} from ${entry.consumedOn} — ${entry.foodName}, ${entry.quantity} ${entry.unit}, ${Math.round(entry.calories)} kcal.`,
    actions: [
      {
        tool: 'delete_entry',
        type: 'meal_deleted',
        label: `Deleted ${entry.foodName} from ${entry.consumedOn}`,
        entryId: entry.id,
      },
    ],
    pendingAction: null,
  };
}

async function applyBulk(
  userId: string,
  pending: PendingAction,
  text: string,
  choice?: PendingChoice,
): Promise<PendingOutcome> {
  if (choice?.confirm === false || NO.test(text.trim())) {
    return { reply: 'Okay, I left those meals as they are.', actions: [], pendingAction: null };
  }

  if (choice?.confirm !== true && !YES.test(text.trim())) {
    return { reply: describePending(pending), actions: [], pendingAction: pending };
  }

  const actions: ChatAction[] = [];

  for (const candidate of pending.candidates) {
    await entriesService.deleteEntry(userId, candidate.entryId);
    actions.push({
      tool: 'delete_entry',
      type: 'meal_deleted',
      label: `Deleted ${candidate.foodName} from ${candidate.consumedOn}`,
      entryId: candidate.entryId,
    });
  }

  return {
    reply: `Deleted ${actions.length} meal ${actions.length === 1 ? 'entry' : 'entries'}.`,
    actions,
    pendingAction: null,
  };
}

function pickCandidate(
  candidates: EntryRef[],
  text: string,
  choice?: PendingChoice,
): ReturnType<typeof resolveAmong> {
  if (choice?.entryId) {
    const found = candidates.find((entry) => entry.entryId === choice.entryId);
    return found ? { status: 'one', entry: found } : { status: 'none' };
  }

  const hint = hintFromText(text);
  if (choice?.index) {
    hint.index = choice.index;
  }

  return resolveAmong(candidates, hint);
}

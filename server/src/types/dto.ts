import type { MealType } from '../domain/nutrition.js';

/**
 * Shapes that routes hand to services after validation.
 *
 * These mirror the validator chains in `src/validators`. When you add a field to
 * a chain, add it here too: express-validator checks values at runtime but does
 * not generate types, so this file is the compile-time half of the contract.
 */

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface MicronutrientInput {
  nutrient: string;
  amount: number;
  unit?: string;
}

export interface CreateEntryInput {
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  /** Defaults to the current time in the service when omitted. */
  consumedAt?: Date;
  /**
   * The calendar day this entry belongs to, as "YYYY-MM-DD".
   *
   * Sent separately from `consumedAt` because a day cannot be derived from an
   * instant without knowing where the eater was: 00:30 in Delhi and 19:00 in
   * London are the same moment but different days. Omitted, the service falls
   * back to the UTC day of `consumedAt`.
   */
  consumedOn?: string;
  /** Optional note on the entry. Not used in reports. */
  notes?: string;
  micronutrients?: MicronutrientInput[];
}

export interface CreateEntriesBatchInput {
  entries: CreateEntryInput[];
  /** Defaults to manual. "image" when the plate was read from a photo. */
  source?: 'manual' | 'image';
}

export type UpdateEntryInput = Partial<CreateEntryInput>;

export type EntrySortField = 'consumedAt' | 'calories' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface ListEntriesQuery extends PaginationQuery {
  from?: Date;
  to?: Date;
  mealType?: MealType;
  search?: string;
  sort: EntrySortField;
  order: SortOrder;
}

export interface CreateGoalInput {
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  targetWeightKg?: number;
  /** Defaults to today in the service when omitted. */
  effectiveFrom?: Date;
}

export type ListGoalsQuery = PaginationQuery;

export interface ReportRangeQuery extends PaginationQuery {
  from?: Date;
  to?: Date;
}

export interface ChatTurnInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestInput {
  /** The conversation so far, oldest first, ending with the user's new message. */
  messages: ChatTurnInput[];
  /**
   * The user's own calendar day, as "YYYY-MM-DD". Anchors "today" and "yesterday"
   * for the assistant and decides which day a logged meal counts towards, for the
   * same reason `consumedOn` exists on an entry.
   */
  today?: string;
  conversationId?: string;
  /** Echoed back from the previous turn when a choice or confirmation is pending. */
  pendingAction?: unknown;
  choice?: { entryId?: string; index?: number; confirm?: boolean };
}

export interface DietBotRequestInput {
  messages: ChatTurnInput[];
  today?: string;
  conversationId?: string;
  /** The page they have open, so "how do I…?" can answer for this screen. */
  page?: string;
}

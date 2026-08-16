import type { MealType } from '../domain/nutrition.js';

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
  consumedAt?: Date;
  consumedOn?: string;
  notes?: string;
  micronutrients?: MicronutrientInput[];
}

export interface CreateEntriesBatchInput {
  entries: CreateEntryInput[];
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
  effectiveFrom?: Date;
}

export type ListGoalsQuery = PaginationQuery;

export interface CreateWeightInput {
  kg: number;
  loggedOn?: string;
  note?: string;
}

export type ListWeightsQuery = PaginationQuery;

export interface ReportRangeQuery extends PaginationQuery {
  from?: Date;
  to?: Date;
}

export interface ChatTurnInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestInput {
  messages: ChatTurnInput[];
  today?: string;
  conversationId?: string;
  pendingAction?: unknown;
  choice?: { entryId?: string; index?: number; confirm?: boolean };
}

export interface DietBotRequestInput {
  messages: ChatTurnInput[];
  today?: string;
  conversationId?: string;
  page?: string;
}

/**
 * Shapes returned by the API.
 *
 * Declared here rather than imported from the server: the assignment requires
 * the frontend to be a separate application that talks to the backend only over
 * HTTP, so the two projects share no code. This file is the client's view of
 * that contract.
 */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
};

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Macros {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface Micronutrient {
  nutrient: string;
  label: string;
  amount: number;
  unit: string;
}

export interface FoodEntry {
  id: string;
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  macros: Macros;
  micronutrients: Micronutrient[];
  consumedAt: string;
  consumedOn: string;
  source: 'manual' | 'image' | 'pdf' | 'chat';
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface EntriesResponse extends Paginated<FoodEntry> {
  totals: { calories: number } & Macros;
}

export interface Goal {
  id: string;
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  targetWeightKg: number | null;
  effectiveFrom: string;
  createdAt: string;
}

export interface DailyReportRow extends Macros {
  date: string;
  calories: number;
  entryCount: number;
  goal: ({ dailyCalories: number } & Macros) | null;
  caloriesRemaining: number | null;
}

export interface WeeklyReportRow extends Macros {
  weekStart: string;
  weekEnd: string;
  calories: number;
  entryCount: number;
  daysLogged: number;
  averageDailyCalories: number;
}

export interface MacroBreakdown {
  grams: Macros;
  caloriePercentage: Macros;
  range: { from: string; to: string };
}

export interface MicronutrientRow {
  nutrient: string;
  label: string;
  total: number;
  averagePerDay: number;
  unit: string;
}

export interface GoalComparison {
  range: { from: string; to: string; days: number };
  daysLogged: number;
  actual: { calories: number; averageDailyCalories: number } & Macros;
  target: { calories: number; averageDailyCalories: number } & Macros;
  adherence: ({ calories: number } & Macros) | null;
  hasGoal: boolean;
}

export interface ExtractedItem {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  micronutrients: Micronutrient[];
}

export interface ExtractionResult {
  source: 'nutrition_label' | 'meal_photo';
  suggestedMealType: MealType | null;
  items: ExtractedItem[];
  totals: { calories: number } & Macros;
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  notes: string | null;
}

export interface CreateEntryPayload {
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  consumedAt?: string;
  micronutrients?: { nutrient: string; amount: number; unit?: string }[];
}

export interface CreateGoalPayload {
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  targetWeightKg?: number;
  effectiveFrom?: string;
}

export interface FieldError {
  field: string;
  message: string;
}

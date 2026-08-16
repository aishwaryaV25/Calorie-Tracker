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

/**
 * Nutrients the log form can add by hand. Mirrors the API's known list so a
 * typed amount lands in the same unit the reports already use.
 */
export const MICRONUTRIENTS = {
  vitamin_a: { label: 'Vitamin A', unit: 'mcg' },
  vitamin_c: { label: 'Vitamin C', unit: 'mg' },
  vitamin_d: { label: 'Vitamin D', unit: 'mcg' },
  vitamin_e: { label: 'Vitamin E', unit: 'mg' },
  vitamin_b12: { label: 'Vitamin B12', unit: 'mcg' },
  calcium: { label: 'Calcium', unit: 'mg' },
  iron: { label: 'Iron', unit: 'mg' },
  magnesium: { label: 'Magnesium', unit: 'mg' },
  potassium: { label: 'Potassium', unit: 'mg' },
  sodium: { label: 'Sodium', unit: 'mg' },
  zinc: { label: 'Zinc', unit: 'mg' },
  fiber: { label: 'Fibre', unit: 'g' },
  sugar: { label: 'Sugar', unit: 'g' },
  cholesterol: { label: 'Cholesterol', unit: 'mg' },
} as const;

export type MicronutrientKey = keyof typeof MICRONUTRIENTS;
export const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENTS) as MicronutrientKey[];

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
  notes: string | null;
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

export interface ExtractedComponent {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface ExtractedEntry {
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
  /** The single entry the form is filled with. */
  entry: ExtractedEntry;
  /** Foods on the plate, each ready to become its own diary row. */
  components: ExtractedComponent[];
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
  /** The calendar day the entry counts towards, as the user's clock sees it. */
  consumedOn?: string;
  notes?: string;
  micronutrients?: { nutrient: string; amount: number; unit?: string }[];
}

/** One turn of the conversation. The client keeps the transcript; the API does not. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Something the assistant changed in the diary during a turn. */
export interface ChatAction {
  tool: string;
  type?: 'meal_created' | 'meal_updated' | 'meal_deleted' | 'goals_updated';
  label: string;
  entryId?: string;
}

export interface ChatCandidate {
  entryId: string;
  foodName: string;
  mealType: string;
  quantity: number;
  unit: string;
  calories: number;
  consumedOn: string;
}

export interface ChatPendingAction {
  kind: 'choose_delete' | 'choose_update' | 'confirm_bulk_delete' | 'confirm_extract' | 'review_import';
  originalRequest: string;
  candidates: ChatCandidate[];
  expiresAt: string;
  extract?: ExtractionResult;
  importRows?: ImportDraftRow[];
}

export interface ChatReply {
  reply: string;
  actions: ChatAction[];
  conversationId?: string;
  pendingAction?: ChatPendingAction | null;
}

export interface DietBotReply {
  reply: string;
  conversationId: string;
}

export interface CreateGoalPayload {
  dailyCalories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  targetWeightKg?: number;
  effectiveFrom?: string;
}

export interface ImportDraftRow {
  foodName: string;
  mealType: MealType;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  consumedOn: string;
  consumedAt?: string;
}

export interface ImportPreview {
  method: 'script' | 'gemini';
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

export interface FieldError {
  field: string;
  message: string;
}

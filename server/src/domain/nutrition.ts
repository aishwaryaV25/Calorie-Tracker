/**
 * Domain vocabulary shared by the entry, report, AI and import modules.
 *
 * Meal types and sources are `const` tuples rather than TypeScript enums so the
 * same values can drive Zod validation, static types and runtime iteration
 * without being declared three times.
 */

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ENTRY_SOURCES = ['manual', 'image', 'pdf', 'chat'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const MACRO_KEYS = ['proteinGrams', 'carbGrams', 'fatGrams'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

/**
 * Micronutrients the app understands, with the unit each amount is stored in.
 * Values are normalised to these units on the way in so that totals across
 * entries are always summing like with like.
 *
 * The database itself accepts any nutrient key, which keeps unusual values from
 * an AI extraction from being silently dropped; this list is what the UI labels
 * and what the reports summarise.
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
} as const satisfies Record<string, { label: string; unit: string }>;

export type MicronutrientKey = keyof typeof MICRONUTRIENTS;

export const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENTS) as MicronutrientKey[];

export const isKnownMicronutrient = (key: string): key is MicronutrientKey =>
  Object.hasOwn(MICRONUTRIENTS, key);

/** Canonical unit for a nutrient, falling back to the caller's unit if unknown. */
export const unitForNutrient = (key: string, fallback = 'mg'): string =>
  isKnownMicronutrient(key) ? MICRONUTRIENTS[key].unit : fallback;

/** Human-readable label for a nutrient key, e.g. "vitamin_c" -> "Vitamin C". */
export const labelForNutrient = (key: string): string =>
  isKnownMicronutrient(key)
    ? MICRONUTRIENTS[key].label
    : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Energy contribution per gram, used to sanity-check AI and imported values. */
export const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

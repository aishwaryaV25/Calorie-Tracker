export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ENTRY_SOURCES = ['manual', 'image', 'pdf', 'chat'] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const MACRO_KEYS = ['proteinGrams', 'carbGrams', 'fatGrams'] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

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

export const unitForNutrient = (key: string, fallback = 'mg'): string =>
  isKnownMicronutrient(key) ? MICRONUTRIENTS[key].unit : fallback;

export const labelForNutrient = (key: string): string =>
  isKnownMicronutrient(key)
    ? MICRONUTRIENTS[key].label
    : key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const CALORIES_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

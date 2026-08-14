import {
  CALORIES_PER_GRAM,
  MEAL_TYPES,
  MICRONUTRIENT_KEYS,
  isKnownMicronutrient,
  labelForNutrient,
  unitForNutrient,
  type MealType,
} from '../domain/nutrition.js';
import { AiResponseError, createCompletion, parseJsonContent } from '../lib/ai-client.js';
import { unprocessable } from '../lib/errors.js';

/**
 * The photo is analysed and returned as a *draft* that pre-fills the entry form.
 * Nothing is written to the database here: vision estimates are approximate, so
 * the user reviews and corrects the numbers before saving.
 */

export interface ExtractedItem {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  micronutrients: { nutrient: string; label: string; amount: number; unit: string }[];
}

export interface ExtractionResult {
  source: 'nutrition_label' | 'meal_photo';
  suggestedMealType: MealType | null;
  items: ExtractedItem[];
  totals: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number };
  /** Model's own confidence, surfaced so the UI can prompt for a closer look. */
  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  notes: string | null;
}

/** Raw shape requested from the model, before any checking of our own. */
interface RawExtraction {
  source: string;
  suggestedMealType: string | null;
  confidence: string;
  notes: string | null;
  items: {
    foodName: string;
    quantity: number;
    unit: string;
    calories: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
    micronutrients: { nutrient: string; amount: number }[];
  }[];
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'suggestedMealType', 'confidence', 'notes', 'items'],
  properties: {
    source: {
      type: 'string',
      enum: ['nutrition_label', 'meal_photo'],
      description: 'Whether the image shows a packaged nutrition label or a plate of food.',
    },
    suggestedMealType: {
      type: ['string', 'null'],
      enum: [...MEAL_TYPES, null],
      description: 'Best guess at the meal, or null if the image gives no clue.',
    },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    notes: {
      type: ['string', 'null'],
      description: 'Short note about assumptions made, such as an estimated portion size.',
    },
    items: {
      type: 'array',
      description: 'One entry per distinct food item visible.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'foodName',
          'quantity',
          'unit',
          'calories',
          'proteinGrams',
          'carbGrams',
          'fatGrams',
          'micronutrients',
        ],
        properties: {
          foodName: { type: 'string' },
          quantity: { type: 'number', description: 'Portion amount, matching unit.' },
          unit: { type: 'string', description: 'For example g, ml, piece, cup.' },
          calories: { type: 'number' },
          proteinGrams: { type: 'number' },
          carbGrams: { type: 'number' },
          fatGrams: { type: 'number' },
          micronutrients: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['nutrient', 'amount'],
              properties: {
                nutrient: { type: 'string', enum: MICRONUTRIENT_KEYS },
                amount: {
                  type: 'number',
                  description: 'Amount in the canonical unit for this nutrient.',
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You extract nutrition data from images for a calorie tracking app.

There are two kinds of image:
1. A packaged product's nutrition label. Read the printed values directly. Do not estimate.
   Report values for the serving size shown on the label and set the quantity and unit to that
   serving. If the label lists both "per serving" and "per 100g", prefer per serving.
2. A plate or bowl of food. Identify each distinct item and estimate a realistic portion using
   visual cues such as plate size and cutlery. List each food as its own item.

Rules:
- Use grams for macronutrients and the canonical unit for each micronutrient
  (micrograms for vitamin A, D and B12; milligrams for most minerals; grams for fibre and sugar).
- Only report micronutrients you can actually read or confidently infer. Omit the rest;
  do not pad the list with zeros.
- Calories must be consistent with the macros: protein and carbohydrate are 4 kcal per gram,
  fat is 9 kcal per gram.
- Set confidence to "low" when the image is blurry, partially hidden, or the portion is ambiguous.
- If the image contains no food and no nutrition label, return an empty items array.`;

/** Values above this are almost certainly a misread label rather than real food. */
const MAX_CALORIES_PER_ITEM = 20_000;

export async function extractNutritionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const completion = await createCompletion({
    temperature: 0,
    jsonSchema: { name: 'nutrition_extraction', schema: responseSchema },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract the nutrition information from this image.' },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
        ],
      },
    ],
  });

  const raw = parseJsonContent<RawExtraction>(completion.content);

  return sanitiseExtraction(raw);
}

/**
 * Model output is treated as untrusted input. Numbers are clamped, unknown
 * nutrient keys dropped, and totals recomputed here rather than taken on trust,
 * so a hallucinated value cannot reach the client or the database unchecked.
 */
export function sanitiseExtraction(raw: RawExtraction): ExtractionResult {
  if (!Array.isArray(raw.items)) {
    throw new AiResponseError('The AI response did not include a list of items.');
  }

  const warnings: string[] = [];

  const items: ExtractedItem[] = raw.items
    .filter((item) => typeof item?.foodName === 'string' && item.foodName.trim().length > 0)
    .map((item) => {
      const calories = clamp(item.calories, 0, MAX_CALORIES_PER_ITEM);
      const proteinGrams = clamp(item.proteinGrams, 0, 5_000);
      const carbGrams = clamp(item.carbGrams, 0, 5_000);
      const fatGrams = clamp(item.fatGrams, 0, 5_000);

      const impliedCalories =
        proteinGrams * CALORIES_PER_GRAM.protein +
        carbGrams * CALORIES_PER_GRAM.carbs +
        fatGrams * CALORIES_PER_GRAM.fat;

      // A large gap usually means a misread label or an inconsistent estimate.
      // Surfaced as a warning rather than corrected silently, because either the
      // calories or the macros could be the wrong one.
      if (impliedCalories > 0 && calories > 0) {
        const drift = Math.abs(impliedCalories - calories) / Math.max(impliedCalories, calories);

        if (drift > 0.25) {
          warnings.push(
            `"${item.foodName.trim()}": macros imply about ${Math.round(impliedCalories)} kcal but ${Math.round(calories)} kcal was read. Please check.`,
          );
        }
      }

      return {
        foodName: item.foodName.trim().slice(0, 160),
        quantity: clamp(item.quantity, 0.01, 10_000, 1),
        unit: (item.unit || 'serving').trim().slice(0, 24),
        calories: round(calories),
        proteinGrams: round(proteinGrams),
        carbGrams: round(carbGrams),
        fatGrams: round(fatGrams),
        micronutrients: sanitiseMicronutrients(item.micronutrients),
      };
    });

  if (items.length === 0) {
    throw unprocessable(
      'No food or nutrition label could be recognised in this image. Try a clearer photo, or add the entry manually.',
    );
  }

  const totals = items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      proteinGrams: sum.proteinGrams + item.proteinGrams,
      carbGrams: sum.carbGrams + item.carbGrams,
      fatGrams: sum.fatGrams + item.fatGrams,
    }),
    { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 },
  );

  return {
    source: raw.source === 'nutrition_label' ? 'nutrition_label' : 'meal_photo',
    suggestedMealType: isMealType(raw.suggestedMealType) ? raw.suggestedMealType : null,
    items,
    totals: {
      calories: round(totals.calories),
      proteinGrams: round(totals.proteinGrams),
      carbGrams: round(totals.carbGrams),
      fatGrams: round(totals.fatGrams),
    },
    confidence: isConfidence(raw.confidence) ? raw.confidence : 'low',
    warnings,
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim().slice(0, 400) : null,
  };
}

function sanitiseMicronutrients(input: { nutrient: string; amount: number }[] | undefined) {
  if (!Array.isArray(input)) {
    return [];
  }

  const byKey = new Map<string, { nutrient: string; label: string; amount: number; unit: string }>();

  for (const item of input) {
    const key = typeof item?.nutrient === 'string' ? item.nutrient.trim().toLowerCase() : '';

    // Unknown keys are dropped rather than stored: the schema constrains the
    // model to a known list, and anything else is a hallucination.
    if (!isKnownMicronutrient(key)) {
      continue;
    }

    byKey.set(key, {
      nutrient: key,
      label: labelForNutrient(key),
      amount: round(clamp(item.amount, 0, 100_000)),
      unit: unitForNutrient(key),
    });
  }

  return [...byKey.values()];
}

const isMealType = (value: unknown): value is MealType =>
  typeof value === 'string' && (MEAL_TYPES as readonly string[]).includes(value);

const isConfidence = (value: unknown): value is 'high' | 'medium' | 'low' =>
  value === 'high' || value === 'medium' || value === 'low';

function clamp(value: unknown, min: number, max: number, fallback = 0): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(Math.max(numeric, min), max);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

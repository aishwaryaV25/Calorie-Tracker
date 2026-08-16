import {
  CALORIES_PER_GRAM,
  MEAL_TYPES,
  MICRONUTRIENT_KEYS,
  isKnownMicronutrient,
  labelForNutrient,
  unitForNutrient,
  type MealType,
} from '../domain/nutrition.js';
import { config } from '../config.js';
import { AiResponseError, createCompletion, parseJsonContent } from '../lib/ai-client.js';
import { unprocessable } from '../lib/errors.js';

export interface ExtractedEntry {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  micronutrients: { nutrient: string; label: string; amount: number; unit: string }[];
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

export interface ExtractionResult {
  source: 'nutrition_label' | 'meal_photo';
  suggestedMealType: MealType | null;

  entry: ExtractedEntry;

  components: ExtractedComponent[];

  confidence: 'high' | 'medium' | 'low';
  warnings: string[];
  notes: string | null;
}

interface RawExtraction {
  source: string;
  suggestedMealType: string | null;
  confidence: string;
  notes: string | null;
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  micronutrients: { nutrient: string; amount: number }[];
  components: RawComponent[];
}

interface RawComponent {
  name: string;
  calories: number;
  quantity?: number;
  unit?: string;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
}

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'source',
    'suggestedMealType',
    'confidence',
    'notes',
    'foodName',
    'quantity',
    'unit',
    'calories',
    'proteinGrams',
    'carbGrams',
    'fatGrams',
    'micronutrients',
    'components',
  ],
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
      description: 'One short sentence naming the main assumption, or null.',
    },
    foodName: { type: 'string', description: 'Name for the whole entry.' },
    quantity: { type: 'number', description: 'Portion amount, matching unit.' },
    unit: { type: 'string', description: 'For example g, ml, plate, bowl, piece.' },
    calories: { type: 'number', description: 'Total for the whole entry.' },
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
          amount: { type: 'number', description: 'Amount in the canonical unit for this nutrient.' },
        },
      },
    },
    components: {
      type: 'array',
      description: 'The foods that add up to the totals above. Empty for a single product.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'calories', 'proteinGrams', 'carbGrams', 'fatGrams'],
        properties: {
          name: { type: 'string', description: 'Food name only, e.g. "white bread".' },
          quantity: { type: 'number', description: 'Portion amount for this food.' },
          unit: { type: 'string', description: 'For example g, cup, slice, serving.' },
          calories: { type: 'number' },
          proteinGrams: { type: 'number' },
          carbGrams: { type: 'number' },
          fatGrams: { type: 'number' },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You read food images for a calorie tracker. Reply with one JSON object that fills a food diary.

TWO KINDS OF IMAGE

Nutrition label on packaging:
- Read the printed numbers. Never estimate them.
- Use the serving size printed on the label for quantity and unit, e.g. 40 with unit "g", or 1 with unit "bar".
- If both "per serving" and "per 100 g" are printed, use per serving.
- foodName is the product name. Leave components empty.

Plate, bowl or glass of food:
- foodName names the meal as a whole, e.g. "Fried egg on toast with ham and salad".
- Set the top-level quantity to 1 and unit to what holds it: "plate", "bowl", "glass".
- List every distinct food you can see in components. Each component needs its own name (food only, no portion in the name), quantity, unit, calories, proteinGrams, carbGrams and fatGrams. Judge portions against the plate, cutlery or hand for scale.
- Top-level calories, proteinGrams, carbGrams and fatGrams are the totals for the whole plate. They must equal the sums of the matching component fields.

ALWAYS
- Macros are in grams.
- Keep the numbers self-consistent: protein 4 kcal/g, carbohydrate 4 kcal/g, fat 9 kcal/g.
- micronutrients: only what a label prints or what is clearly present in a recognised food. At most 6. Never pad with zeros.
- confidence: "high" only for a legible label, "medium" for a clear plate of recognisable food, "low" when the image is blurred or cropped, the food is unidentifiable, or the portion is a guess.
- notes: at most one short sentence, naming the main assumption. Use null if there is nothing worth saying.
- If the image shows neither food nor a nutrition label, reply with an empty foodName and 0 calories.
- Output the JSON object only. No explanation, no markdown.`;

const MAX_CALORIES = 20_000;

const MAX_RESPONSE_TOKENS = 1400;

export async function extractNutritionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const completion = await createCompletion({
    temperature: 0,
    maxTokens: MAX_RESPONSE_TOKENS,

    reasoningEffort: config.ai.reasoningEffort,
    rejectionMessage:
      'The AI service could not read this file. It may be corrupt, too small, or in a format the model does not support.',
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

export function sanitiseExtraction(raw: RawExtraction): ExtractionResult {
  if (!raw || typeof raw !== 'object') {
    throw new AiResponseError('The AI response was not an object.');
  }

  const foodName = typeof raw.foodName === 'string' ? raw.foodName.trim() : '';

  if (foodName.length === 0) {
    throw unprocessable(
      'No food or nutrition label could be recognised in this image. Try a clearer photo, or add the entry manually.',
    );
  }

  const calories = clamp(raw.calories, 0, MAX_CALORIES);
  const proteinGrams = clamp(raw.proteinGrams, 0, 5_000);
  const carbGrams = clamp(raw.carbGrams, 0, 5_000);
  const fatGrams = clamp(raw.fatGrams, 0, 5_000);

  const entry: ExtractedEntry = {
    foodName: foodName.slice(0, 160),
    quantity: clamp(raw.quantity, 0.01, 10_000, 1),
    unit: (raw.unit || 'serving').trim().slice(0, 24) || 'serving',
    calories: round(calories),
    proteinGrams: round(proteinGrams),
    carbGrams: round(carbGrams),
    fatGrams: round(fatGrams),
    micronutrients: sanitiseMicronutrients(raw.micronutrients),
  };

  const components = sanitiseComponents(raw.components);

  return {
    source: raw.source === 'nutrition_label' ? 'nutrition_label' : 'meal_photo',
    suggestedMealType: isMealType(raw.suggestedMealType) ? raw.suggestedMealType : null,
    entry,
    components,
    confidence: isConfidence(raw.confidence) ? raw.confidence : 'low',
    warnings: collectWarnings(entry, components),
    notes: typeof raw.notes === 'string' && raw.notes.trim() ? raw.notes.trim().slice(0, 400) : null,
  };
}

const DRIFT_TOLERANCE = 0.25;

function collectWarnings(
  entry: ExtractedEntry,
  components: ExtractedComponent[],
): string[] {
  const warnings: string[] = [];

  const impliedCalories =
    entry.proteinGrams * CALORIES_PER_GRAM.protein +
    entry.carbGrams * CALORIES_PER_GRAM.carbs +
    entry.fatGrams * CALORIES_PER_GRAM.fat;

  if (impliedCalories > 0 && entry.calories > 0 && drifts(impliedCalories, entry.calories)) {
    warnings.push(
      `The macros add up to about ${Math.round(impliedCalories)} kcal, but ${Math.round(entry.calories)} kcal was read. Please check before saving.`,
    );
  }

  const componentCalories = components.reduce((sum, item) => sum + item.calories, 0);

  if (componentCalories > 0 && entry.calories > 0 && drifts(componentCalories, entry.calories)) {
    warnings.push(
      `The items listed come to about ${Math.round(componentCalories)} kcal, but the total says ${Math.round(entry.calories)} kcal.`,
    );
  }

  return warnings;
}

const drifts = (a: number, b: number) => Math.abs(a - b) / Math.max(a, b) > DRIFT_TOLERANCE;

function sanitiseComponents(input: RawComponent[] | undefined): ExtractedComponent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item) => typeof item?.name === 'string' && item.name.trim().length > 0)
    .slice(0, 20)
    .map((item) => ({
      name: item.name.trim().slice(0, 80),
      quantity: clamp(item.quantity, 0.01, 10_000, 1),
      unit: (typeof item.unit === 'string' && item.unit.trim() ? item.unit : 'serving')
        .trim()
        .slice(0, 24),
      calories: round(clamp(item.calories, 0, MAX_CALORIES)),
      proteinGrams: round(clamp(item.proteinGrams, 0, 5_000)),
      carbGrams: round(clamp(item.carbGrams, 0, 5_000)),
      fatGrams: round(clamp(item.fatGrams, 0, 5_000)),
    }));
}

const MAX_MICRONUTRIENTS = 8;

function sanitiseMicronutrients(input: { nutrient: string; amount: number }[] | undefined) {
  if (!Array.isArray(input)) {
    return [];
  }

  const byKey = new Map<string, { nutrient: string; label: string; amount: number; unit: string }>();

  for (const item of input) {
    const key = typeof item?.nutrient === 'string' ? item.nutrient.trim().toLowerCase() : '';

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

  return [...byKey.values()].slice(0, MAX_MICRONUTRIENTS);
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

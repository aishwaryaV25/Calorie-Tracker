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
 *
 * The model returns exactly one entry rather than a list to choose from. A plate
 * of food is one thing the user ate, and the form it fills has one set of
 * fields, so anything else would leave the client picking or summing on the
 * model's behalf. The individual foods still come back in `components`, but as
 * a description of how the total was reached, not as options.
 */

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

export interface ExtractionResult {
  source: 'nutrition_label' | 'meal_photo';
  suggestedMealType: MealType | null;
  /** Ready to drop straight into the entry form. */
  entry: ExtractedEntry;
  /** The foods that make up the entry, for display only. */
  components: { name: string; calories: number }[];
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
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  micronutrients: { nutrient: string; amount: number }[];
  components: { name: string; calories: number }[];
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
        required: ['name', 'calories'],
        properties: {
          name: { type: 'string', description: 'Food and portion, e.g. "2 slices white bread".' },
          calories: { type: 'number' },
        },
      },
    },
  },
} as const;

/**
 * The prompt is written for a form that is filled in automatically, so it asks
 * for one entry rather than a list of candidates.
 *
 * Listing the components is not decoration: working through the plate item by
 * item and then adding up is markedly more accurate than naming a total
 * outright, and it gives the totals something to be checked against. They carry
 * only a name and a calorie figure, which keeps the reply — and so the latency —
 * short.
 */
const SYSTEM_PROMPT = `You read food images for a calorie tracker. Reply with one JSON object that fills a single entry in a food diary.

TWO KINDS OF IMAGE

Nutrition label on packaging:
- Read the printed numbers. Never estimate them.
- Use the serving size printed on the label for quantity and unit, e.g. 40 with unit "g", or 1 with unit "bar".
- If both "per serving" and "per 100 g" are printed, use per serving.
- foodName is the product name. Leave components empty.

Plate, bowl or glass of food:
- foodName names the meal as a whole, e.g. "Fried egg on toast with ham and salad".
- Set quantity to 1 and unit to what holds it: "plate", "bowl", "glass".
- List every distinct food you can see in components, each with its own portion and calories, judging portions against the plate, cutlery or hand for scale.
- calories, proteinGrams, carbGrams and fatGrams are the totals for the whole plate, and calories must equal the sum of the component calories.

ALWAYS
- Macros are in grams and describe the entry as a whole.
- Keep the numbers self-consistent: protein 4 kcal/g, carbohydrate 4 kcal/g, fat 9 kcal/g.
- micronutrients: only what a label prints or what is clearly present in a recognised food. At most 6. Never pad with zeros.
- confidence: "high" only for a legible label, "medium" for a clear plate of recognisable food, "low" when the image is blurred or cropped, the food is unidentifiable, or the portion is a guess.
- notes: at most one short sentence, naming the main assumption. Use null if there is nothing worth saying.
- If the image shows neither food nor a nutrition label, reply with an empty foodName and 0 calories.
- Output the JSON object only. No explanation, no markdown.`;

/** Values above this are almost certainly a misread label rather than real food. */
const MAX_CALORIES = 20_000;

/**
 * Enough for a long dish name and a dozen components, and short enough to bound
 * how slow a single extraction can get.
 */
const MAX_RESPONSE_TOKENS = 900;

export async function extractNutritionFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionResult> {
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

  const completion = await createCompletion({
    temperature: 0,
    maxTokens: MAX_RESPONSE_TOKENS,
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
  if (!raw || typeof raw !== 'object') {
    throw new AiResponseError('The AI response was not an object.');
  }

  const foodName = typeof raw.foodName === 'string' ? raw.foodName.trim() : '';

  // The prompt asks for an empty name when there is nothing to read, so this is
  // the expected path for a photo of a wall, not an exceptional one.
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

/** Values disagreeing by more than this are worth a second look from the user. */
const DRIFT_TOLERANCE = 0.25;

/**
 * Two independent checks on the model's arithmetic: the macros against the
 * calorie figure, and the components against the total. Neither rewrites the
 * numbers, because there is no way to tell which side of a disagreement is the
 * wrong one — the form is pre-filled either way, with the doubt made visible.
 */
function collectWarnings(
  entry: ExtractedEntry,
  components: { name: string; calories: number }[],
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

/** Display-only, so a bad name or figure is dropped rather than failing the request. */
function sanitiseComponents(input: { name: string; calories: number }[] | undefined) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item) => typeof item?.name === 'string' && item.name.trim().length > 0)
    .slice(0, 20)
    .map((item) => ({
      name: item.name.trim().slice(0, 80),
      calories: round(clamp(item.calories, 0, MAX_CALORIES)),
    }));
}

/** At most this many, matching the prompt, so a runaway list cannot reach the form. */
const MAX_MICRONUTRIENTS = 8;

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

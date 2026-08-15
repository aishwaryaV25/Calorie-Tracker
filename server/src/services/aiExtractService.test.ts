import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitiseExtraction } from './aiExtractService.js';

/**
 * The model's output is untrusted input. These cases cover the ways a response
 * can be wrong without being malformed: impossible numbers, invented nutrient
 * keys, and arithmetic that does not add up.
 */

const base = {
  source: 'meal_photo',
  suggestedMealType: 'breakfast',
  confidence: 'high',
  notes: null,
  foodName: 'Oat porridge',
  quantity: 250,
  unit: 'g',
  calories: 294,
  proteinGrams: 10,
  carbGrams: 50,
  fatGrams: 6,
  micronutrients: [] as { nutrient: string; amount: number }[],
  components: [] as {
    name: string;
    calories: number;
    quantity?: number;
    unit?: string;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
  }[],
};

const extraction = (overrides: Partial<typeof base> = {}) => ({ ...base, ...overrides });

describe('sanitiseExtraction', () => {
  it('returns a single entry ready for the form', () => {
    const result = sanitiseExtraction(extraction());

    assert.equal(result.entry.foodName, 'Oat porridge');
    assert.equal(result.entry.quantity, 250);
    assert.equal(result.entry.calories, 294);
    assert.deepEqual(result.warnings, []);
  });

  it('clamps negative and absurd values', () => {
    const result = sanitiseExtraction(
      extraction({ calories: -500, proteinGrams: -3, quantity: 0, fatGrams: 9_999_999 }),
    );

    assert.equal(result.entry.calories, 0);
    assert.equal(result.entry.proteinGrams, 0);
    assert.equal(result.entry.fatGrams, 5_000);
    assert.ok(result.entry.quantity > 0, 'quantity should never be zero');
  });

  it('drops invented micronutrient keys but keeps known ones', () => {
    const result = sanitiseExtraction(
      extraction({
        micronutrients: [
          { nutrient: 'iron', amount: 3 },
          { nutrient: 'unobtainium', amount: 42 },
          { nutrient: 'vitamin_c', amount: 12 },
        ],
      }),
    );

    assert.deepEqual(
      result.entry.micronutrients.map((item) => item.nutrient),
      ['iron', 'vitamin_c'],
    );
  });

  it('applies the canonical unit for each nutrient', () => {
    const result = sanitiseExtraction(
      extraction({ micronutrients: [{ nutrient: 'vitamin_b12', amount: 1.2 }] }),
    );

    assert.equal(result.entry.micronutrients[0]?.unit, 'mcg');
  });

  it('warns when macros and calories disagree, without silently rewriting either', () => {
    // 10g protein + 50g carbs + 6g fat implies roughly 294 kcal, not 1200.
    const result = sanitiseExtraction(extraction({ calories: 1200 }));

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0] ?? '', /please check/i);
    assert.equal(result.entry.calories, 1200, 'the reported value is preserved');
  });

  it('warns when the listed components do not add up to the total', () => {
    const result = sanitiseExtraction(
      extraction({
        components: [
          { name: 'Fried egg', calories: 90 },
          { name: '2 slices toast', calories: 160 },
        ],
      }),
    );

    // 250 kcal of components against a 294 kcal total is within tolerance.
    assert.deepEqual(result.warnings, []);

    const mismatched = sanitiseExtraction(
      extraction({ components: [{ name: 'Fried egg', calories: 90 }] }),
    );

    assert.equal(mismatched.warnings.length, 1);
    assert.match(mismatched.warnings[0] ?? '', /items listed/i);
  });

  it('keeps the components for display but drops unusable ones', () => {
    const result = sanitiseExtraction(
      extraction({
        calories: 90,
        proteinGrams: 6,
        carbGrams: 1,
        fatGrams: 7,
        components: [
          { name: '  ', calories: 10 },
          { name: 'Fried egg', calories: 90 },
        ],
      }),
    );

    assert.deepEqual(result.components, [
      {
        name: 'Fried egg',
        quantity: 1,
        unit: 'serving',
        calories: 90,
        proteinGrams: 0,
        carbGrams: 0,
        fatGrams: 0,
      },
    ]);
  });

  it('keeps portion and macros on a component when the model sends them', () => {
    const result = sanitiseExtraction(
      extraction({
        calories: 420,
        proteinGrams: 40,
        carbGrams: 0,
        fatGrams: 28,
        components: [
          {
            name: 'Grilled salmon',
            quantity: 1,
            unit: 'serving',
            calories: 420,
            proteinGrams: 40,
            carbGrams: 0,
            fatGrams: 28,
          },
        ],
      }),
    );

    assert.deepEqual(result.components[0], {
      name: 'Grilled salmon',
      quantity: 1,
      unit: 'serving',
      calories: 420,
      proteinGrams: 40,
      carbGrams: 0,
      fatGrams: 28,
    });
  });

  it('falls back to low confidence when the model returns something unexpected', () => {
    const result = sanitiseExtraction(
      extraction({ confidence: 'extremely sure', suggestedMealType: 'brunch' }),
    );

    assert.equal(result.confidence, 'low');
    assert.equal(result.suggestedMealType, null);
  });

  it('rejects an image with nothing recognisable in it', () => {
    assert.throws(
      () => sanitiseExtraction(extraction({ foodName: '   ', calories: 0 })),
      /No food or nutrition label/,
    );
  });
});

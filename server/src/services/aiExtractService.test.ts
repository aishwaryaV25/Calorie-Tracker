import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitiseExtraction } from './aiExtractService.js';

/**
 * The model's output is untrusted input. These cases cover the ways a response
 * can be wrong without being malformed: impossible numbers, invented nutrient
 * keys, and macros that disagree with the stated calories.
 */

const baseItem = {
  foodName: 'Oat porridge',
  quantity: 250,
  unit: 'g',
  calories: 300,
  proteinGrams: 10,
  carbGrams: 50,
  fatGrams: 6,
  micronutrients: [] as { nutrient: string; amount: number }[],
};

const extraction = (overrides: Partial<typeof baseItem>[], rest = {}) => ({
  source: 'meal_photo',
  suggestedMealType: 'breakfast',
  confidence: 'high',
  notes: null,
  items: overrides.map((override) => ({ ...baseItem, ...override })),
  ...rest,
});

describe('sanitiseExtraction', () => {
  it('recomputes totals from the items rather than trusting the model', () => {
    const result = sanitiseExtraction(
      extraction([
        { foodName: 'Toast', calories: 200, proteinGrams: 6, carbGrams: 30, fatGrams: 5 },
        { foodName: 'Egg', calories: 78, proteinGrams: 6, carbGrams: 1, fatGrams: 5 },
      ]),
    );

    assert.equal(result.totals.calories, 278);
    assert.equal(result.totals.proteinGrams, 12);
    assert.equal(result.totals.fatGrams, 10);
  });

  it('clamps negative and absurd values', () => {
    const result = sanitiseExtraction(
      extraction([{ calories: -500, proteinGrams: -3, quantity: 0, fatGrams: 9_999_999 }]),
    );

    const item = result.items[0];
    assert.ok(item);
    assert.equal(item.calories, 0);
    assert.equal(item.proteinGrams, 0);
    assert.equal(item.fatGrams, 5_000);
    assert.ok(item.quantity > 0, 'quantity should never be zero');
  });

  it('drops invented micronutrient keys but keeps known ones', () => {
    const result = sanitiseExtraction(
      extraction([
        {
          micronutrients: [
            { nutrient: 'iron', amount: 3 },
            { nutrient: 'unobtainium', amount: 42 },
            { nutrient: 'vitamin_c', amount: 12 },
          ],
        },
      ]),
    );

    const keys = result.items[0]?.micronutrients.map((m) => m.nutrient);
    assert.deepEqual(keys, ['iron', 'vitamin_c']);
  });

  it('applies the canonical unit for each nutrient', () => {
    const result = sanitiseExtraction(
      extraction([{ micronutrients: [{ nutrient: 'vitamin_b12', amount: 1.2 }] }]),
    );

    assert.equal(result.items[0]?.micronutrients[0]?.unit, 'mcg');
  });

  it('warns when macros and calories disagree, without silently rewriting either', () => {
    // 10g protein + 50g carbs + 6g fat implies roughly 294 kcal, not 1200.
    const result = sanitiseExtraction(extraction([{ calories: 1200 }]));

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0] ?? '', /please check/i);
    assert.equal(result.items[0]?.calories, 1200, 'the reported value is preserved');
  });

  it('stays quiet when macros and calories agree', () => {
    const result = sanitiseExtraction(extraction([{ calories: 294 }]));
    assert.deepEqual(result.warnings, []);
  });

  it('falls back to low confidence when the model returns something unexpected', () => {
    const result = sanitiseExtraction(
      extraction([{}], { confidence: 'extremely sure', suggestedMealType: 'brunch' }),
    );

    assert.equal(result.confidence, 'low');
    assert.equal(result.suggestedMealType, null);
  });

  it('rejects an image with nothing recognisable in it', () => {
    assert.throws(() => sanitiseExtraction(extraction([])), /No food or nutrition label/);
  });

  it('ignores items with no usable name', () => {
    const result = sanitiseExtraction(extraction([{ foodName: '   ' }, { foodName: 'Banana' }]));

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.foodName, 'Banana');
  });
});

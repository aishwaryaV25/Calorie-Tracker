import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDiaryText } from './pdfImportParser.js';

const TODAY = '2026-08-15';

describe('parseDiaryText', () => {
  it('reads a pipe table whose headers use everyday names', () => {
    const text = `
      Type of meal | Name of meal | Calories | Protein | Carbs | Fat
      Breakfast | Porridge with berries | 420 | 12 | 68 | 9
      Lunch | Chicken salad | 610 | 48 | 30 | 32
      Dinner | Paneer curry | 780 | 26 | 95 | 28
    `;

    const result = parseDiaryText(text, TODAY);

    assert.equal(result.rows.length, 3);
    assert.equal(result.rows[0]?.foodName, 'Porridge with berries');
    assert.equal(result.rows[0]?.mealType, 'breakfast');
    assert.equal(result.rows[0]?.calories, 420);
    assert.equal(result.rows[1]?.proteinGrams, 48);
    assert.equal(result.rows[2]?.fatGrams, 28);
    assert.match(result.schema ?? '', /header/i);
  });

  it('reads a CSV with short column names and a date', () => {
    const text = `
      Date,Food,kcal,P,C,F
      2026-08-10,Toast,280,8,40,6
      10/08/2026,Idli,180,6,32,2
    `;

    const result = parseDiaryText(text, TODAY);

    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.consumedOn, '2026-08-10');
    assert.equal(result.rows[1]?.consumedOn, '2026-08-10');
    assert.equal(result.rows[0]?.calories, 280);
    assert.equal(result.rows[1]?.foodName, 'Idli');
  });

  it('falls back to the most common positional layout when there is no header', () => {
    const text = `
      Breakfast  Porridge  420  12  68  9
      Lunch  Chicken salad  610  48  30  32
    `;

    const result = parseDiaryText(text, TODAY);

    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.mealType, 'breakfast');
    assert.equal(result.rows[0]?.foodName, 'Porridge');
    assert.equal(result.rows[1]?.calories, 610);
  });

  it('pulls trailing numbers off a wrapped sentence', () => {
    const text = 'Porridge with berries 420 12 68 9\nApple 95';

    const result = parseDiaryText(text, TODAY);

    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.foodName, 'Porridge with berries');
    assert.equal(result.rows[0]?.calories, 420);
    assert.equal(result.rows[0]?.proteinGrams, 12);
    assert.equal(result.rows[1]?.foodName, 'Apple');
    assert.equal(result.rows[1]?.calories, 95);
  });

  it('infers a meal type from the food name when the PDF never says it', () => {
    const text = 'Oatmeal 310\nBiryani 740\nProtein bar 210';

    const result = parseDiaryText(text, TODAY);

    assert.equal(result.rows[0]?.mealType, 'breakfast');
    assert.equal(result.rows[1]?.mealType, 'lunch');
    assert.equal(result.rows[2]?.mealType, 'snack');
    assert.equal(result.rows[0]?.consumedOn, TODAY);
  });

  it('returns an empty preview, not a guess, when the text is not a diary', () => {
    const result = parseDiaryText('This is a letter to my landlord about the leaking tap.', TODAY);

    assert.equal(result.rows.length, 0);
    assert.ok(result.warnings[0]?.includes('Deep Analyse'));
  });
});

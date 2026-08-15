import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ExtractionResult } from './aiExtractService.js';
import {
  applyAttachPending,
  editImportRows,
  formatExtraction,
  formatImportTable,
  formatTextTable,
} from './chatAttach.js';
import { createPending } from './chatPending.js';
import type { ImportDraftRow } from './pdfImportParser.js';

function row(overrides: Partial<ImportDraftRow> = {}): ImportDraftRow {
  return {
    foodName: 'Oats',
    mealType: 'breakfast',
    quantity: 1,
    unit: 'bowl',
    calories: 300,
    proteinGrams: 10,
    carbGrams: 50,
    fatGrams: 6,
    consumedOn: '2026-08-15',
    ...overrides,
  };
}

function extract(overrides: Partial<ExtractionResult['entry']> = {}): ExtractionResult {
  return {
    source: 'meal_photo',
    suggestedMealType: 'lunch',
    confidence: 'high',
    warnings: [],
    notes: null,
    components: [{ name: 'Rice', quantity: 1, unit: 'cup', calories: 200, proteinGrams: 4, carbGrams: 45, fatGrams: 0 }],
    entry: {
      foodName: 'Rice and chicken',
      quantity: 1,
      unit: 'plate',
      calories: 520,
      proteinGrams: 38,
      carbGrams: 55,
      fatGrams: 14,
      micronutrients: [],
      ...overrides,
    },
  };
}

describe('chatAttach', () => {
  it('formats a text table with aligned columns', () => {
    const table = formatTextTable([
      ['#', 'Food', 'kcal'],
      ['1', 'Oats', '300'],
      ['2', 'Salmon', '520'],
    ]);

    const lines = table.split('\n');
    assert.equal(lines.length, 3);
    assert.match(lines[0] ?? '', /^#\s+Food\s+kcal$/);
    assert.ok((lines[1] ?? '').indexOf('Oats') < (lines[1] ?? '').indexOf('300'));
  });

  it('renders import rows as a numbered snapshot, not an image', () => {
    const table = formatImportTable([row(), row({ foodName: 'Salmon', mealType: 'dinner', calories: 520 })]);
    assert.match(table, /^#\s+Meal\s+Food/);
    assert.match(table, /1\s+breakfast\s+Oats/);
    assert.match(table, /2\s+dinner\s+Salmon/);
    assert.doesNotMatch(table, /data:image|```/);
  });

  it('lists plate components as display-only on a photo draft', () => {
    const text = formatExtraction(extract());
    assert.match(text, /Rice and chicken/);
    assert.match(text, /520/);
    assert.match(text, /not saved as separate rows/);
    assert.match(text, /Rice/);
  });

  it('edits a draft row by number and column', () => {
    const result = editImportRows([row(), row({ foodName: 'Salmon', calories: 520 })], 'row 2 calories 480');
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.rows[1]?.calories, 480);
      assert.equal(result.rows[0]?.calories, 300);
    }
  });

  it('edits a draft row by food name', () => {
    const result = editImportRows([row(), row({ foodName: 'Salmon', calories: 520 })], 'change oats calories to 280');
    assert.equal(result.status, 'ok');
    if (result.status === 'ok') {
      assert.equal(result.rows[0]?.calories, 280);
    }
  });

  it('asks for a row number when two foods match', () => {
    const result = editImportRows(
      [row({ foodName: 'Oats with milk' }), row({ foodName: 'Overnight oats', calories: 220 })],
      'oats calories 200',
    );
    assert.equal(result.status, 'ambiguous');
  });

  it('ignores a message that is not an edit', () => {
    assert.equal(editImportRows([row()], 'how am I doing today?').status, 'none');
  });

  it('discards a photo draft when the user cancels', async () => {
    const pending = createPending('confirm_extract', 'photo', []);
    pending.extract = extract();
    const outcome = await applyAttachPending('user', pending, 'cancel', '2026-08-15');
    assert.match(outcome.reply, /discarded/);
    assert.equal(outcome.pendingAction, null);
    assert.equal(outcome.unhandled, undefined);
  });

  it('updates a photo draft meal type from plain language', async () => {
    const pending = createPending('confirm_extract', 'photo', []);
    pending.extract = extract();
    const outcome = await applyAttachPending('user', pending, 'make it dinner', '2026-08-15');
    assert.ok(outcome.pendingAction?.extract);
    assert.equal(outcome.pendingAction?.extract?.suggestedMealType, 'dinner');
    assert.match(outcome.reply, /Updated draft/);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { labelForNutrient, unitForNutrient } from './nutrition.js';

describe('nutrition labels', () => {
  it('uses the canonical label and unit for known micros', () => {
    assert.equal(labelForNutrient('vitamin_c'), 'Vitamin C');
    assert.equal(unitForNutrient('vitamin_c'), 'mg');
    assert.equal(unitForNutrient('vitamin_a'), 'mcg');
  });

  it('title-cases unknown keys instead of dropping them', () => {
    assert.equal(labelForNutrient('omega_3'), 'Omega 3');
    assert.equal(unitForNutrient('omega_3', 'g'), 'g');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPending,
  describePending,
  isPendingExpired,
  looksLikePendingReply,
} from './chatPending.js';
import type { EntryRef } from './chatResolve.js';

const rice: EntryRef = {
  entryId: 'rice',
  foodName: 'Rice',
  mealType: 'lunch',
  quantity: 1,
  unit: 'cup',
  calories: 200,
  consumedOn: '2026-08-14',
};

const salmon: EntryRef = {
  entryId: 'salmon',
  foodName: 'Salmon',
  mealType: 'dinner',
  quantity: 1,
  unit: 'serving',
  calories: 520,
  consumedOn: '2026-08-14',
};

describe('chatPending', () => {
  it('asks which meal when several could be deleted', () => {
    const pending = createPending('choose_delete', 'Remove yesterday\'s meal', [rice, salmon]);
    const prompt = describePending(pending);
    assert.match(prompt, /I found 2 meals/);
    assert.match(prompt, /Rice/);
    assert.match(prompt, /Which one should I remove/);
  });

  it('asks for confirmation before a bulk delete', () => {
    const pending = createPending('confirm_bulk_delete', 'delete all', [rice, salmon]);
    assert.match(describePending(pending), /remove 2 meal entries from 2026-08-14/);
  });

  it('treats Lunch and Yes as pending replies, not a new request', () => {
    const pending = createPending('choose_delete', 'remove', [rice, salmon]);
    assert.equal(looksLikePendingReply('Lunch', pending), true);
    assert.equal(looksLikePendingReply('Yes', pending), true);
    assert.equal(
      looksLikePendingReply('Also set my calorie goal to 2200 while you are at it please', pending),
      false,
    );
  });

  it('expires a pending choice after its timestamp', () => {
    const pending = createPending('choose_delete', 'remove', [rice]);
    pending.expiresAt = new Date(Date.now() - 1000).toISOString();
    assert.equal(isPendingExpired(pending), true);
  });
});

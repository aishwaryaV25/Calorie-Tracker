import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resetRateLimits, takeSlot } from './rateLimit.js';

describe('rateLimit', () => {
  it('allows traffic up to the cap, then asks the caller to wait', () => {
    resetRateLimits();
    const start = 1_000_000;

    assert.equal(takeSlot('user', 3, 60_000, start), null);
    assert.equal(takeSlot('user', 3, 60_000, start + 10), null);
    assert.equal(takeSlot('user', 3, 60_000, start + 20), null);

    const wait = takeSlot('user', 3, 60_000, start + 30);
    assert.ok(wait !== null && wait >= 1);
  });

  it('keeps two callers on separate counters', () => {
    resetRateLimits();
    assert.equal(takeSlot('a', 1, 60_000, 1), null);
    assert.equal(takeSlot('b', 1, 60_000, 1), null);
    assert.ok(takeSlot('a', 1, 60_000, 2) !== null);
  });

  it('frees a slot after the window slides past the oldest hit', () => {
    resetRateLimits();
    assert.equal(takeSlot('user', 1, 1_000, 0), null);
    assert.ok(takeSlot('user', 1, 1_000, 500) !== null);
    assert.equal(takeSlot('user', 1, 1_000, 1_001), null);
  });
});

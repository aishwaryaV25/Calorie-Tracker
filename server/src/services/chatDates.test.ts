import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveDate, resolveDateRange } from './chatDates.js';

describe('chatDates', () => {
  const today = '2026-08-15';

  it('resolves today, yesterday and tomorrow from the caller day', () => {
    assert.equal(resolveDate('what did I eat today?', today), '2026-08-15');
    assert.equal(resolveDate("yesterday's meal", today), '2026-08-14');
    assert.equal(resolveDate('tomorrow', today), '2026-08-16');
  });

  it('resolves this week as Monday through today', () => {
    assert.deepEqual(resolveDateRange('this week', today), { from: '2026-08-10', to: '2026-08-15' });
  });

  it('resolves last week as the previous ISO week', () => {
    assert.deepEqual(resolveDateRange('last week', today), { from: '2026-08-03', to: '2026-08-09' });
  });

  it('resolves last Monday as the most recent past Monday', () => {
    assert.equal(resolveDate('last Monday', today), '2026-08-10');
  });

  it('resolves a named calendar day', () => {
    assert.equal(resolveDate('August 14', today), '2026-08-14');
  });
});

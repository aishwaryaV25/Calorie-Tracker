import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveDate, resolveDateRange, resolveReportWindow } from './chatDates.js';

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

  it('defaults a report with no dates to the previous ISO week', () => {
    assert.deepEqual(resolveReportWindow({ today }), { from: '2026-08-03', to: '2026-08-09' });
    assert.deepEqual(resolveReportWindow({ today, period: 'unknown' }), {
      from: '2026-08-03',
      to: '2026-08-09',
    });
  });

  it('resolves named report periods from the caller day', () => {
    assert.deepEqual(resolveReportWindow({ today, period: 'this_week' }), {
      from: '2026-08-10',
      to: '2026-08-15',
    });
    assert.deepEqual(resolveReportWindow({ today, period: 'last_7_days' }), {
      from: '2026-08-09',
      to: '2026-08-15',
    });
    assert.deepEqual(resolveReportWindow({ today, period: 'this_month' }), {
      from: '2026-08-01',
      to: '2026-08-15',
    });
    assert.deepEqual(resolveReportWindow({ today, period: 'last_month' }), {
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('lets explicit dates win, and swaps them when they arrive backwards', () => {
    assert.deepEqual(resolveReportWindow({ today, from: '2026-08-01', to: '2026-08-10' }), {
      from: '2026-08-01',
      to: '2026-08-10',
    });
    assert.deepEqual(resolveReportWindow({ today, from: '2026-08-10', to: '2026-08-01' }), {
      from: '2026-08-01',
      to: '2026-08-10',
    });
    assert.deepEqual(resolveReportWindow({ today, from: '2026-08-01' }), {
      from: '2026-08-01',
      to: '2026-08-15',
    });
    assert.deepEqual(resolveReportWindow({ today, to: '2026-08-10' }), {
      from: '2026-08-10',
      to: '2026-08-10',
    });
  });

  it('ignores a malformed date and falls back to the period', () => {
    assert.deepEqual(resolveReportWindow({ today, from: 'not-a-date', period: 'last_week' }), {
      from: '2026-08-03',
      to: '2026-08-09',
    });
  });
});

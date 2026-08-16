import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  differenceInDays,
  eachDayInRange,
  fromDateKey,
  startOfIsoWeek,
  startOfUtcDay,
  toDateKey,
} from './dates.js';

describe('dates', () => {
  it('treats a YYYY-MM-DD key as midnight UTC, not a local wall-clock instant', () => {
    const day = fromDateKey('2026-08-15');
    assert.equal(day.toISOString(), '2026-08-15T00:00:00.000Z');
    assert.equal(toDateKey(day), '2026-08-15');
  });

  it('does not shift a date-only key when startOfUtcDay is applied', () => {
    assert.equal(toDateKey(startOfUtcDay(fromDateKey('2026-01-01'))), '2026-01-01');
  });

  it('walks an inclusive range so empty report days stay visible', () => {
    const days = eachDayInRange(fromDateKey('2026-08-14'), fromDateKey('2026-08-16'));
    assert.deepEqual(days.map(toDateKey), ['2026-08-14', '2026-08-15', '2026-08-16']);
    assert.equal(differenceInDays(fromDateKey('2026-08-16'), fromDateKey('2026-08-14')), 2);
  });

  it('finds Monday of the ISO week', () => {

    assert.equal(toDateKey(startOfIsoWeek(fromDateKey('2026-08-15'))), '2026-08-10');
    assert.equal(toDateKey(addDays(fromDateKey('2026-08-15'), 1)), '2026-08-16');
  });
});

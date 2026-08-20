import { describe, expect, it } from 'vitest';
import { toNumberArray } from '../snapshots';
import { isoWeekStart } from '../dates';

describe('isoWeekStart', () => {
  it('returns Monday for a Wednesday', () => {
    // Wed 2026-05-20 → Mon 2026-05-18
    const start = isoWeekStart(new Date('2026-05-20T10:30:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('returns the same Monday for Monday', () => {
    const start = isoWeekStart(new Date('2026-05-18T00:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('returns previous Monday for Sunday', () => {
    // Sun 2026-05-24 → Mon 2026-05-18
    const start = isoWeekStart(new Date('2026-05-24T23:59:59Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-05-18');
  });

  it('crosses month boundary correctly', () => {
    // Fri 2026-05-01 → Mon 2026-04-27
    const start = isoWeekStart(new Date('2026-05-01T12:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-04-27');
  });

  it('crosses year boundary correctly', () => {
    // Fri 2026-01-02 → Mon 2025-12-29
    const start = isoWeekStart(new Date('2026-01-02T12:00:00Z'));
    expect(start.toISOString().slice(0, 10)).toBe('2025-12-29');
  });

  it('returns time set to midnight UTC', () => {
    const start = isoWeekStart(new Date('2026-05-20T15:30:00Z'));
    expect(start.toISOString()).toBe('2026-05-18T00:00:00.000Z');
  });
});

// Regression: ARRAY_AGG of float8 arrives as a JS array, but numeric[] arrives
// as the raw literal "{1.5,2.5}". Calling .filter on that threw
// "(e.sold_days_listed ?? []).filter is not a function", which failed the whole
// weekly snapshot step — while the cron around it still reported success, so
// market_snapshots quietly stopped updating.
describe('toNumberArray', () => {
  it('accepts the array shape the driver usually returns', () => {
    expect(toNumberArray([1.5, 2.5])).toEqual([1.5, 2.5]);
  });

  it('accepts the raw Postgres array literal', () => {
    expect(toNumberArray('{1.5,2.5,3}')).toEqual([1.5, 2.5, 3]);
  });

  it('treats null and an empty aggregate as no rows', () => {
    expect(toNumberArray(null)).toEqual([]);
    expect(toNumberArray('{}')).toEqual([]);
  });

  it('drops values that are not numbers rather than yielding NaN', () => {
    expect(toNumberArray('{1,NULL,3}')).toEqual([1, 3]);
  });
});

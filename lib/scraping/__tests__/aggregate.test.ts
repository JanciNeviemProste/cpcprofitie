import { describe, expect, it } from 'vitest';
import { computeSnapshot } from '../aggregate';

describe('computeSnapshot', () => {
  it('returns null stats and zero count when there are no rows', () => {
    expect(computeSnapshot([])).toEqual({
      countActive: 0,
      avgPriceEur: null,
      medianPriceEur: null,
      p25PriceEur: null,
      p75PriceEur: null,
      daysToSellAvg: null,
    });
  });

  it('computes percentiles using linear interpolation', () => {
    const prices = [10000, 12000, 14000, 16000, 18000];
    const stats = computeSnapshot(prices.map((p) => ({ priceEur: p, daysListed: null })));
    expect(stats.countActive).toBe(5);
    expect(stats.medianPriceEur).toBe(14000);
    expect(stats.p25PriceEur).toBe(12000);
    expect(stats.p75PriceEur).toBe(16000);
    expect(stats.avgPriceEur).toBe(14000);
  });

  it('skips invalid prices but keeps the input row count', () => {
    const stats = computeSnapshot([
      { priceEur: 10000, daysListed: 5 },
      { priceEur: 0, daysListed: 7 },
      { priceEur: 20000, daysListed: 3 },
    ]);
    expect(stats.countActive).toBe(3);
    expect(stats.medianPriceEur).toBe(15000);
    expect(stats.daysToSellAvg).toBe(5);
  });
});

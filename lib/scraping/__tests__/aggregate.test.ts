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
      { priceEur: 10000, daysListed: null },
      { priceEur: 0, daysListed: null },
      { priceEur: 20000, daysListed: null },
    ]);
    expect(stats.countActive).toBe(3);
    expect(stats.medianPriceEur).toBe(15000);
  });

  it('refuses to publish a days-to-sell from too few sales', () => {
    // It used to publish from one. A single sold car set the headline
    // "days to sell" for a whole cohort — and the sold set was itself 93%
    // listings that were already gone the first time we fetched them.
    const prices = [{ priceEur: 10000, daysListed: null }];
    expect(computeSnapshot(prices, [5]).daysToSellAvg).toBeNull();
    expect(computeSnapshot(prices, [5, 7, 3, 9]).daysToSellAvg).toBeNull();
    expect(computeSnapshot(prices, [5, 7, 3, 9, 11]).daysToSellAvg).toBe(7);
  });

  it('takes the median of sold lifetimes, not the mean', () => {
    // Time-to-sell is heavily skewed. One car that sat for 300 days drags a
    // mean somewhere no actual car has ever been.
    const prices = [{ priceEur: 10000, daysListed: null }];
    expect(computeSnapshot(prices, [3, 4, 5, 6, 300]).daysToSellAvg).toBe(5);
  });

  it('keeps prices and sold lifetimes apart', () => {
    // They were once zipped by position, pairing the n-th active price with
    // the n-th sale and truncating to the shorter list. The two have nothing
    // to do with each other: one is cars on sale, the other is cars that left.
    const stats = computeSnapshot(
      [{ priceEur: 10000, daysListed: null }],
      [10, 20, 30, 40, 50],
    );
    expect(stats.countActive).toBe(1);
    expect(stats.daysToSellAvg).toBe(30);
  });
});

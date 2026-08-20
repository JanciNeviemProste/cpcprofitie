// Pure aggregation step: takes raw normalized listings (already filtered to a
// model+region+period) and computes the snapshot stats stored in
// market_snapshots. Kept DB-free so it's testable in unit tests.

export type SnapshotInput = { priceEur: number; daysListed: number | null };

export type SnapshotStats = {
  countActive: number;
  avgPriceEur: number | null;
  medianPriceEur: number | null;
  p25PriceEur: number | null;
  p75PriceEur: number | null;
  daysToSellAvg: number | null;
};

/**
 * Sales needed before a days-to-sell figure is worth publishing.
 *
 * It was one. A single sold car produced a headline "days to sell" for a whole
 * cohort, and since the sold set was itself 93% fabricated, the number was an
 * average of one invention.
 */
export const MIN_SOLD_FOR_DAYS = 5;

/**
 * Prices and sold-lifetimes are separate arguments because they are separate
 * populations: the active cars we can price, and the cars that left. They were
 * previously carried in one row type and zipped by position, which paired the
 * n-th active price with the n-th sale — two lists that have nothing to do with
 * each other, silently truncated to the shorter one.
 */
export function computeSnapshot(
  rows: SnapshotInput[],
  soldDaysListed: number[] = [],
): SnapshotStats {
  const prices = rows.map((r) => r.priceEur).filter((p): p is number => Number.isFinite(p) && p > 0);
  const days = soldDaysListed.filter((d) => Number.isFinite(d) && d >= 0);

  return {
    countActive: rows.length,
    avgPriceEur: prices.length ? round2(mean(prices)) : null,
    medianPriceEur: prices.length ? Math.round(percentile(prices, 0.5)) : null,
    p25PriceEur: prices.length ? Math.round(percentile(prices, 0.25)) : null,
    p75PriceEur: prices.length ? Math.round(percentile(prices, 0.75)) : null,
    // Median, not mean: time-to-sell is heavily skewed, and one car that sat for
    // 300 days drags a mean somewhere no actual car has ever been.
    daysToSellAvg: days.length >= MIN_SOLD_FOR_DAYS ? round2(percentile(days, 0.5)) : null,
  };
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function percentile(xs: number[], q: number): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1] ?? lo;
  return lo + rest * (hi - lo);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

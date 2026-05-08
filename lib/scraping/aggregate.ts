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

export function computeSnapshot(rows: SnapshotInput[]): SnapshotStats {
  const prices = rows.map((r) => r.priceEur).filter((p): p is number => Number.isFinite(p) && p > 0);
  const days = rows
    .map((r) => r.daysListed)
    .filter((d): d is number => d !== null && Number.isFinite(d) && d >= 0);

  return {
    countActive: rows.length,
    avgPriceEur: prices.length ? round2(mean(prices)) : null,
    medianPriceEur: prices.length ? Math.round(percentile(prices, 0.5)) : null,
    p25PriceEur: prices.length ? Math.round(percentile(prices, 0.25)) : null,
    p75PriceEur: prices.length ? Math.round(percentile(prices, 0.75)) : null,
    daysToSellAvg: days.length ? round2(mean(days)) : null,
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

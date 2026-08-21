import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A guard that has to be remembered is a guard that goes missing. `is_vehicle`
// was hand-repeated across these files and ended up absent from three of the
// four, so every surface a visitor actually reads priced bumpers as cars for
// months with nothing to say so. The country guard is the same shape of risk:
// leave it out of one query and that surface quietly prices Slovak cars off
// Czech ones.
//
// This test does not check SQL semantics — the quality tests do that. It
// checks that each file computing the price reference still goes through a
// named market predicate at all.
const REFERENCE_QUERIES = [
  'lib/analytics/snapshots.ts',
  'lib/analytics/flip-opportunities.ts',
  'lib/db/queries/trends.ts',
  'lib/db/queries/dashboard.ts',
];

const MARKET_PREDICATES = [
  'marketReferenceRaw',
  'marketReference(',
  'slovakMarketRaw',
  'slovakMarket(',
];

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');
}

describe('price reference queries', () => {
  it.each(REFERENCE_QUERIES)('%s scopes its reference to a market', (rel) => {
    const src = read(rel);
    // Raw SQL in the analytics queries, drizzle's builder in dashboard.ts.
    expect(src.includes('FROM listings') || src.includes('.from(listings)')).toBe(true);
    expect(MARKET_PREDICATES.some((p) => src.includes(p))).toBe(true);
  });

  it('scores Czech candidates against the Slovak reference, not out of the product', () => {
    // active_canonical is the pool being scored; cohort_pool is the reference.
    // Filtering both would delete exactly the arbitrage this product exists to
    // surface — a Czech car priced under the Slovak median.
    const src = read('lib/analytics/flip-opportunities.ts');
    const activeStart = src.indexOf('active_canonical AS (');
    const poolStart = src.indexOf('cohort_pool AS (');
    expect(activeStart).toBeGreaterThan(-1);
    expect(poolStart).toBeGreaterThan(activeStart);

    const activeBlock = src.slice(activeStart, poolStart);
    const poolBlock = src.slice(poolStart, src.indexOf('cohort_agg AS ('));

    expect(poolBlock).toContain('marketReferenceRaw');
    expect(activeBlock).not.toContain('marketReferenceRaw');
    expect(activeBlock).not.toContain('slovakMarketRaw');
  });
});

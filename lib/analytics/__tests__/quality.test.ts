import { describe, expect, it } from 'vitest';
import {
  MILEAGE_MAX,
  PRICE_MAX,
  PRICE_MIN,
  YEAR_MIN,
  marketReferenceRaw,
  plausibleListing,
  plausiblePricedRaw,
  slovakMarketRaw,
} from '../quality';

// The predicates are drizzle SQL fragments; we assert the compiled SQL string
// carries the bounds and the intended NULL semantics, so a future edit that
// drops a bound or flips NULL handling fails loudly.
function toSql(fragment: { toString: () => string }): string {
  // drizzle SQL objects stringify to a parameterized form; good enough to
  // assert structure and that both bounds are present.
  return JSON.stringify(fragment);
}

describe('bounds constants', () => {
  it('are sane and ordered', () => {
    expect(PRICE_MIN).toBeGreaterThan(0);
    expect(PRICE_MAX).toBeGreaterThan(PRICE_MIN);
    expect(MILEAGE_MAX).toBeGreaterThan(100_000);
    expect(YEAR_MIN).toBe(1980);
  });
});

describe('plausibleListing', () => {
  it('references all three columns and allows NULLs', () => {
    const frag = plausibleListing({
      priceEur: 'price_eur',
      mileageKm: 'mileage_km',
      year: 'year',
    });
    const s = toSql(frag);
    expect(s).toContain('IS NULL');
    // both price bounds encoded as params
    expect(s).toContain(String(PRICE_MIN));
    expect(s).toContain(String(PRICE_MAX));
    expect(s).toContain(String(MILEAGE_MAX));
  });
});

describe('plausiblePricedRaw', () => {
  it('requires a non-null price within bounds (median math needs a price)', () => {
    const s = toSql(plausiblePricedRaw('l'));
    expect(s).toContain('IS NOT NULL');
    expect(s).toContain(String(PRICE_MIN));
    expect(s).toContain(String(PRICE_MAX));
  });
});

describe('slovakMarketRaw', () => {
  it('lets an unknown country through', () => {
    // autobazar.eu rows only gain a country when the rotation re-reads them.
    // A hard equality here would drop tens of thousands of rows we know
    // nothing bad about — the predicate excludes what is known foreign.
    const s = toSql(slovakMarketRaw('l'));
    expect(s).toContain('country IS NULL');
    expect(s).toContain('OR');
  });

  it('names the market it admits', () => {
    expect(toSql(slovakMarketRaw('l'))).toContain('country');
  });
});

describe('marketReferenceRaw', () => {
  // The point of this composite is that no caller has to remember a list.
  // is_vehicle was missing from three of four query sites for months because
  // it was a list to remember; a fourth guard must not repeat that.
  it('carries every guard the price reference depends on', () => {
    const s = toSql(marketReferenceRaw('l'));
    expect(s).toContain('is_vehicle');
    expect(s).toContain('price_eur');
    expect(s).toContain('country');
    expect(s).toContain(String(PRICE_MIN));
    expect(s).toContain(String(PRICE_MAX));
  });
});

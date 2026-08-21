// Shared plausibility bounds for listing values. Implausible values (a €1
// listing, 9,000,000 km) poison cohort percentiles and DealScore — every
// cohort/median query filters through these so one junk row can't skew a
// whole model's market price.

import { sql, type SQL } from 'drizzle-orm';
import { listings } from '@/lib/db/schema';

export const PRICE_MIN = 100;
export const PRICE_MAX = 500_000;
export const MILEAGE_MAX = 1_000_000;
export const YEAR_MIN = 1980;

/**
 * SQL predicate that a listing's price/mileage/year are within sane bounds.
 * Pass the drizzle column refs so it composes into an existing WHERE via
 * drizzle's `and(...)`. NULL values pass (a missing mileage shouldn't drop a
 * listing that has a valid price) — only present-but-implausible values fail.
 */
export function plausibleListing(cols: {
  priceEur: SQL | unknown;
  mileageKm: SQL | unknown;
  year: SQL | unknown;
}): SQL {
  const nextYear = new Date().getFullYear() + 1;
  return sql`(
    (${cols.priceEur} IS NULL OR (${cols.priceEur} >= ${PRICE_MIN} AND ${cols.priceEur} <= ${PRICE_MAX}))
    AND (${cols.mileageKm} IS NULL OR (${cols.mileageKm} >= 0 AND ${cols.mileageKm} <= ${MILEAGE_MAX}))
    AND (${cols.year} IS NULL OR (${cols.year} >= ${YEAR_MIN} AND ${cols.year} <= ${nextYear}))
  )`;
}

/**
 * Raw-SQL variant for queries that reference columns by a table alias string
 * (e.g. the cohort CTEs in flip-opportunities use `l.` / `cp.`). `alias` is the
 * table alias, e.g. 'l'. Only priced rows are considered plausible here because
 * cohort/median math is meaningless without a price.
 */
export function plausiblePricedRaw(alias: string): SQL {
  const nextYear = new Date().getFullYear() + 1;
  const a = sql.raw(alias);
  return sql`(
    ${a}.price_eur IS NOT NULL AND ${a}.price_eur >= ${PRICE_MIN} AND ${a}.price_eur <= ${PRICE_MAX}
    AND (${a}.mileage_km IS NULL OR (${a}.mileage_km >= 0 AND ${a}.mileage_km <= ${MILEAGE_MAX}))
    AND (${a}.year IS NULL OR (${a}.year >= ${YEAR_MIN} AND ${a}.year <= ${nextYear}))
  )`;
}

/**
 * The market this product describes. Everything outside it is excluded from
 * the price reference — not from the product.
 *
 * `country IS NULL` passes deliberately. autobazar.eu rows only gain a country
 * when the rotation re-reads them, and a hard `= 'SK'` would drop tens of
 * thousands of rows we know nothing bad about. This predicate means "exclude
 * what we know is not Slovak", not "admit only what is confirmed Slovak", and
 * it tightens on its own as coverage grows.
 *
 * Spelled out because the inverse mistake has been made here before: during
 * dedup an `IS DISTINCT FROM` over NULLs left 7 660 false merges. This is a
 * decision, not an oversight.
 */
export const SLOVAK_MARKET_COUNTRY = 'SK';

export function slovakMarketRaw(alias: string): SQL {
  const a = sql.raw(alias);
  return sql`(${a}.country IS NULL OR ${a}.country = ${SLOVAK_MARKET_COUNTRY})`;
}

export function slovakMarket(country: SQL | unknown): SQL {
  return sql`(${country} IS NULL OR ${country} = ${SLOVAK_MARKET_COUNTRY})`;
}

/**
 * Every guard a row must pass to be part of the Slovak price reference:
 * a real vehicle, a plausible price, and a Slovak market.
 *
 * One name instead of three, because keeping them as a list to remember is how
 * `is_vehicle` came to be missing from three of the four query sites for
 * months while the product priced bumpers as cars. Adding a fourth item to
 * that list would have repeated the mistake.
 *
 * Note this is the *reference* pool. Deliberately not applied to the pool of
 * listings being scored: a Czech car priced under the Slovak median is the
 * arbitrage this product exists to surface, the same shape as a Danish import.
 */
export function marketReferenceRaw(alias: string): SQL {
  const a = sql.raw(alias);
  return sql`(
    ${a}.is_vehicle = true
    AND ${plausiblePricedRaw(alias)}
    AND ${slovakMarketRaw(alias)}
  )`;
}

/** Drizzle-column variant of {@link marketReferenceRaw}. */
export function marketReference(cols: {
  priceEur: SQL | unknown;
  mileageKm: SQL | unknown;
  year: SQL | unknown;
}): SQL {
  return sql`(
    ${listings.isVehicle} = true
    AND ${plausibleListing(cols)}
    AND ${slovakMarket(listings.country)}
  )`;
}

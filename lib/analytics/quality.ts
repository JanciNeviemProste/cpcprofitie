// Shared plausibility bounds for listing values. Implausible values (a €1
// listing, 9,000,000 km) poison cohort percentiles and DealScore — every
// cohort/median query filters through these so one junk row can't skew a
// whole model's market price.

import { sql, type SQL } from 'drizzle-orm';

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

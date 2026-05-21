// Flip opportunity detection. For every active canonical listing with a
// price, compares against its cohort (same model + region + year-bucket +
// mileage-bucket) and flags listings priced meaningfully below the cohort
// median. Output → flip_opportunities table, displayed in /app/deals.
//
// Confidence levels:
//   - low:    cohort 5-9 listings,  OR cohort spans listings older than 30d
//   - medium: cohort 10-19, recent (<= 30d old)
//   - high:   cohort >= 20, all listings <= 14d old
//
// We only insert rows with discountPct > 5% — anything less is noise once
// you factor in dealer markup, inspection, paperwork.

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { toBigInt } from '@/lib/db/bigint';
import { flipOpportunities } from '@/lib/db/schema';

export type FlipComputeStats = {
  candidatesScanned: number;
  opportunitiesUpserted: number;
  skippedSmallCohort: number;
  skippedTooSmallDiscount: number;
  deletedStale: number;
};

const MIN_DISCOUNT_PCT = 5;
const MIN_COHORT_FOR_SIGNAL = 5;

/**
 * Recompute flip_opportunities for every active canonical listing.
 * Idempotent: existing rows are upserted; rows for listings that no longer
 * qualify (sold, removed, no longer underpriced) are deleted.
 */
export async function computeFlipOpportunities(): Promise<FlipComputeStats> {
  const db = getDb();
  const stats: FlipComputeStats = {
    candidatesScanned: 0,
    opportunitiesUpserted: 0,
    skippedSmallCohort: 0,
    skippedTooSmallDiscount: 0,
    deletedStale: 0,
  };

  // Strategy: one big SQL CTE that, per active canonical listing, joins to
  // its cohort and computes percentiles via percentile_cont. Then we filter
  // in TS, upsert qualifiers, and delete non-qualifiers.
  //
  // percentile_cont(0.5) WITHIN GROUP (ORDER BY price) is the standard
  // Postgres percentile aggregate.
  const candidates = (await db.execute(sql`
    WITH active_canonical AS (
      SELECT
        l.id,
        l.model_id,
        l.region,
        l.price_eur::float8 AS price_eur,
        CASE
          WHEN l.year IS NULL THEN 'unknown'
          WHEN l.year >= 2020 THEN '2020+'
          WHEN l.year >= 2015 THEN '2015-19'
          WHEN l.year >= 2010 THEN '2010-14'
          ELSE '<2010'
        END AS year_bucket,
        CASE
          WHEN l.mileage_km IS NULL OR l.mileage_km < 0 THEN 'unknown'
          WHEN l.mileage_km < 50000 THEN '0-50k'
          WHEN l.mileage_km < 100000 THEN '50-100k'
          WHEN l.mileage_km < 150000 THEN '100-150k'
          ELSE '150k+'
        END AS mileage_bucket,
        l.first_seen_at
      FROM listings l
      WHERE l.canonical_listing_id IS NULL
        AND l.sold_at IS NULL
        AND l.removed_at IS NULL
        AND l.price_eur IS NOT NULL
        AND l.price_eur > 0
        AND l.model_id IS NOT NULL
    ),
    cohort_agg AS (
      SELECT
        model_id,
        region,
        year_bucket,
        mileage_bucket,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY price_eur) AS median_eur,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY price_eur) AS p25_eur,
        COUNT(*) AS cohort_size,
        MIN(first_seen_at) AS cohort_oldest
      FROM active_canonical
      GROUP BY model_id, region, year_bucket, mileage_bucket
    )
    SELECT
      ac.id,
      ac.price_eur,
      ca.median_eur,
      ca.p25_eur,
      ca.cohort_size,
      ca.cohort_oldest
    FROM active_canonical ac
    JOIN cohort_agg ca USING (model_id, region, year_bucket, mileage_bucket)
  `)) as unknown as Array<{
    id: string | number | bigint;
    price_eur: number;
    median_eur: number | null;
    p25_eur: number | null;
    cohort_size: number | string;
    cohort_oldest: Date | string | null;
  }>;

  stats.candidatesScanned = candidates.length;

  const now = Date.now();
  const qualifyingIds: bigint[] = [];

  for (const c of candidates) {
    const cohortSize = Number(c.cohort_size);
    if (cohortSize < MIN_COHORT_FOR_SIGNAL) {
      stats.skippedSmallCohort++;
      continue;
    }
    if (c.median_eur == null || c.median_eur <= 0) continue;

    const discountPct = ((c.median_eur - c.price_eur) / c.median_eur) * 100;
    if (discountPct < MIN_DISCOUNT_PCT) {
      stats.skippedTooSmallDiscount++;
      continue;
    }

    const cohortOldestMs = c.cohort_oldest
      ? new Date(c.cohort_oldest).getTime()
      : now;
    const cohortAgeDays = (now - cohortOldestMs) / (1000 * 60 * 60 * 24);

    let confidence: 'low' | 'medium' | 'high';
    if (cohortSize >= 20 && cohortAgeDays <= 14) {
      confidence = 'high';
    } else if (cohortSize >= 10 && cohortAgeDays <= 30) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const listingId = toBigInt(c.id);
    const potentialGain = c.median_eur - c.price_eur;

    await db
      .insert(flipOpportunities)
      .values({
        listingId,
        marketMedianEur: String(Math.round(c.median_eur)),
        marketP25Eur: String(Math.round(c.p25_eur ?? c.median_eur)),
        discountPct: String(round2(discountPct)),
        potentialGainEur: String(Math.round(potentialGain)),
        cohortSize,
        confidence,
      })
      .onConflictDoUpdate({
        target: flipOpportunities.listingId,
        set: {
          marketMedianEur: sql`excluded.market_median_eur`,
          marketP25Eur: sql`excluded.market_p25_eur`,
          discountPct: sql`excluded.discount_pct`,
          potentialGainEur: sql`excluded.potential_gain_eur`,
          cohortSize: sql`excluded.cohort_size`,
          confidence: sql`excluded.confidence`,
          computedAt: sql`now()`,
        },
      });
    qualifyingIds.push(listingId);
    stats.opportunitiesUpserted++;
  }

  // Delete stale rows — opportunities whose listing no longer qualifies.
  // (Sold/removed listings cascade-delete via the FK, but listings that
  // simply re-priced themselves out of the deal range need an explicit purge.)
  if (qualifyingIds.length > 0) {
    const deleted = await db.execute(sql`
      DELETE FROM flip_opportunities
      WHERE listing_id NOT IN (${sql.join(qualifyingIds, sql`, `)})
      RETURNING listing_id
    `);
    stats.deletedStale = (deleted as unknown as unknown[]).length;
  } else {
    const deleted = await db.execute(sql`DELETE FROM flip_opportunities RETURNING listing_id`);
    stats.deletedStale = (deleted as unknown as unknown[]).length;
  }

  return stats;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Flip opportunity detection. For every active canonical listing with a
// price, compares against its cohort (same model, year±2, mileage±25k) and
// flags listings priced below the cohort p25 with cohort size >= 5.
// Output → flip_opportunities table, displayed in /app/deals.
//
// Confidence levels:
//   - low:    cohort 5-9 listings,  OR cohort spans listings older than 30d
//   - medium: cohort 10-19, recent (<= 30d old)
//   - high:   cohort >= 20, all listings <= 14d old
//
// In addition to the discount/cohort fields, we compute the DealScore
// 0-100 (see lib/analytics/deal-score.ts), a human-readable explainer,
// and an estimated profit (sell @ median − price − recond − fees).

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { toBigInt } from '@/lib/db/bigint';
import { flipOpportunities } from '@/lib/db/schema';
import { buildExplainer, computeDealScore, estimateProfit } from './deal-score';

export type FlipComputeStats = {
  candidatesScanned: number;
  opportunitiesUpserted: number;
  skippedSmallCohort: number;
  skippedTooSmallDiscount: number;
  deletedStale: number;
};

const MIN_COHORT_FOR_SIGNAL = 5;
const DEFAULT_RECOND_EUR = 800;

type CandidateRow = {
  id: string | number | bigint;
  price_eur: number;
  median_eur: number | null;
  p25_eur: number | null;
  cohort_size: number | string;
  cohort_oldest: Date | string | null;
  first_seen_at: Date | string | null;
  seller_type: 'private' | 'dealer' | null;
  photo_count: number | string | null;
  year: number | null;
  region: string | null;
  make_name: string | null;
  model_name: string | null;
};

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

  // Strategy: per active canonical listing, compute its cohort window
  // (same model, year±2, mileage±25k, active, not self), percentile_cont
  // for median+p25, plus auxiliary signals (seller_type, photo_count,
  // make/model/year/region) needed for DealScore + explainer.
  const candidates = (await db.execute(sql`
    WITH active_canonical AS (
      SELECT
        l.id,
        l.model_id,
        l.price_eur::float8 AS price_eur,
        l.year,
        l.mileage_km,
        l.region,
        l.first_seen_at
      FROM listings l
      WHERE l.canonical_listing_id IS NULL
        AND l.sold_at IS NULL
        AND l.removed_at IS NULL
        AND l.price_eur IS NOT NULL
        AND l.price_eur > 0
        AND l.model_id IS NOT NULL
        AND l.year IS NOT NULL
        AND l.mileage_km IS NOT NULL
        AND l.mileage_km >= 0
    ),
    cohort_pool AS (
      SELECT
        l.id,
        l.model_id,
        l.price_eur::float8 AS price_eur,
        l.year,
        l.mileage_km,
        l.first_seen_at
      FROM listings l
      WHERE l.canonical_listing_id IS NULL
        AND l.sold_at IS NULL
        AND l.removed_at IS NULL
        AND l.price_eur IS NOT NULL
        AND l.price_eur > 0
        AND l.model_id IS NOT NULL
        AND l.year IS NOT NULL
        AND l.mileage_km IS NOT NULL
        AND l.mileage_km >= 0
    ),
    cohort_agg AS (
      SELECT
        ac.id AS listing_id,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY cp.price_eur) AS median_eur,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY cp.price_eur) AS p25_eur,
        COUNT(*) AS cohort_size,
        MIN(cp.first_seen_at) AS cohort_oldest
      FROM active_canonical ac
      JOIN cohort_pool cp
        ON cp.model_id = ac.model_id
       AND cp.id <> ac.id
       AND cp.year BETWEEN ac.year - 2 AND ac.year + 2
       AND cp.mileage_km BETWEEN ac.mileage_km - 25000 AND ac.mileage_km + 25000
      GROUP BY ac.id
    ),
    photo_counts AS (
      SELECT lp.listing_id, COUNT(*)::int AS photo_count
      FROM listing_photos lp
      JOIN active_canonical ac ON ac.id = lp.listing_id
      GROUP BY lp.listing_id
    )
    SELECT
      ac.id,
      ac.price_eur,
      ac.year,
      ac.region,
      ac.first_seen_at,
      ca.median_eur,
      ca.p25_eur,
      ca.cohort_size,
      ca.cohort_oldest,
      ld.seller_type,
      COALESCE(pc.photo_count, 0) AS photo_count,
      vmk.name AS make_name,
      vm.name  AS model_name
    FROM active_canonical ac
    JOIN cohort_agg ca ON ca.listing_id = ac.id
    LEFT JOIN listing_details ld ON ld.listing_id = ac.id
    LEFT JOIN photo_counts pc ON pc.listing_id = ac.id
    LEFT JOIN vehicle_models vm ON vm.id = ac.model_id
    LEFT JOIN vehicle_makes vmk ON vmk.id = vm.make_id
  `)) as unknown as CandidateRow[];

  stats.candidatesScanned = candidates.length;

  const now = Date.now();
  const qualifyingIds: bigint[] = [];
  const upsertRows: (typeof flipOpportunities.$inferInsert)[] = [];

  for (const c of candidates) {
    const cohortSize = Number(c.cohort_size);
    if (cohortSize < MIN_COHORT_FOR_SIGNAL) {
      stats.skippedSmallCohort++;
      continue;
    }
    if (c.median_eur == null || c.median_eur <= 0) continue;
    if (c.p25_eur == null) continue;

    // Real deal filter: must be priced below cohort p25.
    if (c.price_eur >= c.p25_eur) {
      stats.skippedTooSmallDiscount++;
      continue;
    }

    const discountPct = ((c.median_eur - c.price_eur) / c.median_eur) * 100;

    const cohortOldestMs = c.cohort_oldest ? new Date(c.cohort_oldest).getTime() : now;
    const cohortAgeDays = (now - cohortOldestMs) / (1000 * 60 * 60 * 24);

    let confidence: 'low' | 'medium' | 'high';
    if (cohortSize >= 20 && cohortAgeDays <= 14) {
      confidence = 'high';
    } else if (cohortSize >= 10 && cohortAgeDays <= 30) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const firstSeenMs = c.first_seen_at ? new Date(c.first_seen_at).getTime() : now;
    const daysSinceFirstSeen = Math.max(0, (now - firstSeenMs) / (1000 * 60 * 60 * 24));
    const photoCount = Number(c.photo_count ?? 0);

    const dsInput = {
      priceEur: c.price_eur,
      cohortMedianEur: c.median_eur,
      cohortSize,
      sellerType: c.seller_type,
      photoCount,
      daysSinceFirstSeen,
    };
    const ds = computeDealScore(dsInput);
    const explainer = buildExplainer(
      dsInput,
      c.make_name ?? '',
      c.model_name ?? '',
      c.year,
      c.region,
    );
    const estProfit = estimateProfit(c.price_eur, c.median_eur, DEFAULT_RECOND_EUR);

    const listingId = toBigInt(c.id);
    const potentialGain = c.median_eur - c.price_eur;

    upsertRows.push({
      listingId,
      marketMedianEur: String(Math.round(c.median_eur)),
      marketP25Eur: String(Math.round(c.p25_eur)),
      discountPct: String(round2(discountPct)),
      potentialGainEur: String(Math.round(potentialGain)),
      cohortSize,
      confidence,
      dealScore: ds.score,
      scoreBreakdown: ds.breakdown,
      explainer,
      estRecondEur: DEFAULT_RECOND_EUR,
      estProfitEur: estProfit,
    });
    qualifyingIds.push(listingId);
  }

  // Multi-row upserts in chunks — one round-trip per ~500 rows instead of one
  // per candidate (thousands of sequential queries were a timeout risk).
  const CHUNK = 500;
  for (let i = 0; i < upsertRows.length; i += CHUNK) {
    const chunk = upsertRows.slice(i, i + CHUNK);
    await db
      .insert(flipOpportunities)
      .values(chunk)
      .onConflictDoUpdate({
        target: flipOpportunities.listingId,
        set: {
          marketMedianEur: sql`excluded.market_median_eur`,
          marketP25Eur: sql`excluded.market_p25_eur`,
          discountPct: sql`excluded.discount_pct`,
          potentialGainEur: sql`excluded.potential_gain_eur`,
          cohortSize: sql`excluded.cohort_size`,
          confidence: sql`excluded.confidence`,
          dealScore: sql`excluded.deal_score`,
          scoreBreakdown: sql`excluded.score_breakdown`,
          explainer: sql`excluded.explainer`,
          estRecondEur: sql`excluded.est_recond_eur`,
          estProfitEur: sql`excluded.est_profit_eur`,
          computedAt: sql`now()`,
        },
      });
    stats.opportunitiesUpserted += chunk.length;
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

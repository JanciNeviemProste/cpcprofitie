// Read-only data-quality metrics for the scraped listings corpus. Powers the
// admin data-quality page and the /api/admin/data-quality endpoint. No writes.
//
// The numbers here answer: how complete are the fields DealScore/market
// analytics depend on (model_id, price, year, mileage, seller_type), how much
// implausible data is poisoning cohorts, and per-source where it's worst.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '../index';
// Single source of truth for plausibility bounds — the same values the
// cohort/percentile queries filter on, so the "outlier" counts here match
// exactly what gets excluded downstream.
import { MILEAGE_MAX, PRICE_MAX, PRICE_MIN, YEAR_MIN } from '@/lib/analytics/quality';

export type SourceHealth = 'ok' | 'warn' | 'drift';

export type SourceCompleteness = {
  source: string;
  total: number;
  active: number;
  nullPricePct: number;
  nullYearPct: number;
  nullMileagePct: number;
  nullFuelPct: number;
  nullTransmissionPct: number;
  nullRegionPct: number;
  nullModelPct: number;
  outlierPrice: number;
  outlierMileage: number;
  // Share of active listings carrying every field a DealScore cohort needs.
  cohortReadyPct: number;
  // Coarse health verdict for at-a-glance drift detection: a source whose
  // price or model coverage cratered almost always means a broken selector,
  // not a market shift. This is what would have flagged the autobazar.sk
  // 100%-null-price regression within a day instead of months.
  health: SourceHealth;
  healthReason: string | null;
};

// A price collapse is the strongest selector-drift signal (real markets never
// stop listing prices); model/region collapse is the next tier.
function assessHealth(c: {
  nullPricePct: number;
  nullModelPct: number;
  nullRegionPct: number;
}): { health: SourceHealth; healthReason: string | null } {
  if (c.nullPricePct >= 60) {
    return { health: 'drift', healthReason: `cena chýba ${c.nullPricePct}% — možný drift selektora` };
  }
  if (c.nullModelPct >= 70) {
    return { health: 'drift', healthReason: `model chýba ${c.nullModelPct}% — parser/enrichment` };
  }
  if (c.nullPricePct >= 30 || c.nullRegionPct >= 60 || c.nullModelPct >= 50) {
    return { health: 'warn', healthReason: 'zvýšená chýbovosť kľúčových polí' };
  }
  return { health: 'ok', healthReason: null };
}

/** Test seam — the health verdict is pure logic worth locking down. */
export const assessHealthForTest = assessHealth;

export type DriftAlert = { source: string; health: SourceHealth; reason: string };

/**
 * Pick the sources worth alerting on from a report — anything not `ok`.
 * Pure so the cron's decision is unit-testable without a DB.
 */
export function pickDriftAlerts(report: DataQualityReport): DriftAlert[] {
  return report.completeness
    .filter((c) => c.health !== 'ok')
    .map((c) => ({
      source: c.source,
      health: c.health,
      reason: c.healthReason ?? 'zvýšená chýbovosť',
    }));
}

export type EnrichmentCoverage = {
  source: string;
  active: number;
  enrichedPct: number;
  sellerTypePct: number;
  vinPct: number;
  powerPct: number;
};

export type DealScoreHealth = {
  activeCanonical: number;
  flipRows: number;
  withDealScore: number;
  avgCohortSize: number | null;
};

export type DedupHealth = {
  total: number;
  canonical: number;
  repostClones: number;
  repostPct: number;
  vinCoveragePct: number;
  // Largest repost cluster (clones sharing one canonical). A wild value flags
  // over-clustering (the false-merge symptom the guard prevents).
  maxClusterSize: number;
  // VINs seen on 2+ sources — the same car cross-posted, deduped by the VIN pass.
  crossSourceVinClusters: number;
};

export type DataQualityReport = {
  generatedAt: string;
  completeness: SourceCompleteness[];
  enrichment: EnrichmentCoverage[];
  dealScore: DealScoreHealth;
  dedup: DedupHealth;
};

export function computeRepostPct(repostClones: number, total: number): number {
  return pct(repostClones, total);
}

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10; // one decimal
}

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const generatedAt = new Date().toISOString();
  const nextYear = new Date().getFullYear() + 1;
  try {
    const db = getDb();

    // Null rates are computed over ACTIVE listings only. Sold/removed rows are
    // never re-scraped, so their historical nulls would otherwise (a) drown out
    // a fresh selector drift in the total and (b) keep a just-fixed source
    // pinned at "drift" forever. The `_active` FILTER on every null count is
    // what makes the drift alert actually track live extraction health.
    const ACTIVE = sql`canonical_listing_id IS NULL AND sold_at IS NULL AND removed_at IS NULL`;
    const completenessRows = (await db.execute(sql`
      SELECT
        source,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE ${ACTIVE})::int AS active,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND price_eur IS NULL)::int AS null_price,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND year IS NULL)::int AS null_year,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND mileage_km IS NULL)::int AS null_mileage,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND fuel IS NULL)::int AS null_fuel,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND transmission IS NULL)::int AS null_transmission,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND region IS NULL)::int AS null_region,
        COUNT(*) FILTER (WHERE ${ACTIVE} AND model_id IS NULL)::int AS null_model,
        COUNT(*) FILTER (
          WHERE ${ACTIVE} AND price_eur IS NOT NULL AND (price_eur < ${PRICE_MIN} OR price_eur > ${PRICE_MAX})
        )::int AS outlier_price,
        COUNT(*) FILTER (
          WHERE ${ACTIVE} AND mileage_km IS NOT NULL AND mileage_km > ${MILEAGE_MAX}
        )::int AS outlier_mileage,
        COUNT(*) FILTER (
          WHERE ${ACTIVE}
            AND model_id IS NOT NULL
            AND price_eur IS NOT NULL AND price_eur >= ${PRICE_MIN} AND price_eur <= ${PRICE_MAX}
            AND year IS NOT NULL AND year >= ${YEAR_MIN} AND year <= ${nextYear}
            AND mileage_km IS NOT NULL AND mileage_km >= 0 AND mileage_km <= ${MILEAGE_MAX}
        )::int AS cohort_ready
      FROM listings
      GROUP BY source
      ORDER BY source
    `)) as unknown as Array<{
      source: string;
      total: number;
      active: number;
      null_price: number;
      null_year: number;
      null_mileage: number;
      null_fuel: number;
      null_transmission: number;
      null_region: number;
      null_model: number;
      outlier_price: number;
      outlier_mileage: number;
      cohort_ready: number;
    }>;

    const completeness: SourceCompleteness[] = completenessRows.map((r) => {
      const nullPricePct = pct(r.null_price, r.active);
      const nullRegionPct = pct(r.null_region, r.active);
      const nullModelPct = pct(r.null_model, r.active);
      const { health, healthReason } = assessHealth({ nullPricePct, nullModelPct, nullRegionPct });
      return {
        source: r.source,
        total: r.total,
        active: r.active,
        nullPricePct,
        nullYearPct: pct(r.null_year, r.active),
        nullMileagePct: pct(r.null_mileage, r.active),
        nullFuelPct: pct(r.null_fuel, r.active),
        nullTransmissionPct: pct(r.null_transmission, r.active),
        nullRegionPct,
        nullModelPct,
        outlierPrice: r.outlier_price,
        outlierMileage: r.outlier_mileage,
        cohortReadyPct: pct(r.cohort_ready, r.active),
        health,
        healthReason,
      };
    });

    const enrichmentRows = (await db.execute(sql`
      SELECT
        l.source,
        COUNT(*)::int AS active,
        COUNT(ld.listing_id)::int AS enriched,
        COUNT(ld.seller_type)::int AS has_seller_type,
        COUNT(ld.vin)::int AS has_vin,
        COUNT(ld.power_kw)::int AS has_power
      FROM listings l
      LEFT JOIN listing_details ld ON ld.listing_id = l.id
      WHERE l.canonical_listing_id IS NULL AND l.sold_at IS NULL AND l.removed_at IS NULL
      GROUP BY l.source
      ORDER BY l.source
    `)) as unknown as Array<{
      source: string;
      active: number;
      enriched: number;
      has_seller_type: number;
      has_vin: number;
      has_power: number;
    }>;

    const enrichment: EnrichmentCoverage[] = enrichmentRows.map((r) => ({
      source: r.source,
      active: r.active,
      enrichedPct: pct(r.enriched, r.active),
      sellerTypePct: pct(r.has_seller_type, r.active),
      vinPct: pct(r.has_vin, r.active),
      powerPct: pct(r.has_power, r.active),
    }));

    const dealRows = (await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM listings
          WHERE canonical_listing_id IS NULL AND sold_at IS NULL AND removed_at IS NULL)::int AS active_canonical,
        (SELECT COUNT(*) FROM flip_opportunities)::int AS flip_rows,
        (SELECT COUNT(*) FROM flip_opportunities WHERE deal_score IS NOT NULL)::int AS with_deal_score,
        (SELECT AVG(cohort_size) FROM flip_opportunities)::float8 AS avg_cohort_size
    `)) as unknown as Array<{
      active_canonical: number;
      flip_rows: number;
      with_deal_score: number;
      avg_cohort_size: number | null;
    }>;

    const d = dealRows[0];
    const dealScore: DealScoreHealth = {
      activeCanonical: d?.active_canonical ?? 0,
      flipRows: d?.flip_rows ?? 0,
      withDealScore: d?.with_deal_score ?? 0,
      avgCohortSize: d?.avg_cohort_size != null ? Math.round(d.avg_cohort_size * 10) / 10 : null,
    };

    const dedupRows = (await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM listings)::int AS total,
        (SELECT COUNT(*) FROM listings WHERE canonical_listing_id IS NULL)::int AS canonical,
        (SELECT COUNT(*) FROM listings WHERE canonical_listing_id IS NOT NULL)::int AS repost_clones,
        (SELECT COUNT(*) FROM listing_details WHERE vin IS NOT NULL AND LENGTH(vin) = 17)::int AS with_vin,
        (SELECT COALESCE(MAX(cnt), 0) FROM (
          SELECT COUNT(*) AS cnt FROM listings
          WHERE canonical_listing_id IS NOT NULL GROUP BY canonical_listing_id
        ) g)::int AS max_cluster_clones,
        (SELECT COUNT(*) FROM (
          SELECT d2.vin FROM listing_details d2 JOIN listings l2 ON l2.id = d2.listing_id
          WHERE d2.vin IS NOT NULL AND LENGTH(d2.vin) = 17
          GROUP BY d2.vin HAVING COUNT(DISTINCT l2.source) > 1
        ) x)::int AS cross_source_vin
    `)) as unknown as Array<{
      total: number;
      canonical: number;
      repost_clones: number;
      with_vin: number;
      max_cluster_clones: number;
      cross_source_vin: number;
    }>;
    const dr = dedupRows[0];
    const dedup: DedupHealth = {
      total: dr?.total ?? 0,
      canonical: dr?.canonical ?? 0,
      repostClones: dr?.repost_clones ?? 0,
      repostPct: computeRepostPct(dr?.repost_clones ?? 0, dr?.total ?? 0),
      vinCoveragePct: pct(dr?.with_vin ?? 0, dr?.total ?? 0),
      // +1 so the count includes the canonical itself (cluster = canonical + clones).
      maxClusterSize: (dr?.max_cluster_clones ?? 0) > 0 ? (dr?.max_cluster_clones ?? 0) + 1 : 0,
      crossSourceVinClusters: dr?.cross_source_vin ?? 0,
    };

    return { generatedAt, completeness, enrichment, dealScore, dedup };
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'data-quality', step: 'getDataQualityReport' } });
    return {
      generatedAt,
      completeness: [],
      enrichment: [],
      dealScore: { activeCanonical: 0, flipRows: 0, withDealScore: 0, avgCohortSize: null },
      dedup: {
        total: 0,
        canonical: 0,
        repostClones: 0,
        repostPct: 0,
        vinCoveragePct: 0,
        maxClusterSize: 0,
        crossSourceVinClusters: 0,
      },
    };
  }
}

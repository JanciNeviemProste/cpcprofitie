// Weekly market snapshot computation. For each (model, region, year-bucket,
// mileage-bucket) cohort, computes price percentiles + sold/active counts +
// days-to-sell. Stored in market_snapshots so the dashboard can render
// trajectories without hitting the raw listings table on every render.
//
// Only canonical listings (canonical_listing_id IS NULL) feed the cohort —
// reposts would over-count the same physical car. Sold = soldAt IS NOT NULL
// in the period; active = soldAt IS NULL AND removedAt IS NULL at capture time.

import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { marketSnapshots } from '@/lib/db/schema';
import { computeSnapshot, type SnapshotInput } from '@/lib/scraping/aggregate';
import { isoWeekStart } from './dates';

export type WeeklySnapshotStats = {
  cohortsComputed: number;
  rowsUpserted: number;
  modelsScanned: number;
};

export { isoWeekStart };

/**
 * Compute weekly snapshots for the current ISO week. Idempotent: re-running
 * for the same week overwrites the cohort's stats (PK is
 * model/region/year-bucket/mileage-bucket/period/captured-on).
 *
 * Minimum cohort size: 3 listings. Below that, the snapshot is skipped — the
 * numbers would be noise. The UI filters by cohort size.
 */
export async function computeWeeklySnapshots(opts: {
  minCohortSize?: number;
  asOf?: Date;
} = {}): Promise<WeeklySnapshotStats> {
  const minCohortSize = opts.minCohortSize ?? 3;
  const asOf = opts.asOf ?? new Date();
  const weekStart = isoWeekStart(asOf);
  // Inline the timestamp literal — Drizzle's `${weekStart}` Date binding
  // intermittently fails type resolution inside ARRAY_AGG…FILTER expressions
  // (pg adapter sends ambiguous type). String literal + ::timestamptz cast
  // sidesteps it without changing semantics.
  const weekStartLit = `'${weekStart.toISOString()}'::timestamptz`;
  const db = getDb();

  // One big SQL: group canonical listings by (model, region, year-bucket,
  // mileage-bucket) and pull the prices + days-listed arrays into JS so
  // computeSnapshot() (already unit-tested) does the actual math.
  const rows = (await db.execute(sql`
    SELECT
      l.model_id,
      coalesce(l.region, 'unknown-region') AS region,
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
      ARRAY_AGG(l.price_eur::float8) FILTER (
        WHERE l.price_eur IS NOT NULL
          AND l.sold_at IS NULL
          AND l.removed_at IS NULL
      ) AS active_prices,
      COUNT(*) FILTER (WHERE l.sold_at IS NOT NULL AND l.sold_at >= ${sql.raw(weekStartLit)}) AS sold_this_week,
      ARRAY_AGG(
        EXTRACT(EPOCH FROM (coalesce(l.sold_at, l.removed_at) - l.first_seen_at)) / 86400.0
      ) FILTER (
        WHERE l.sold_at IS NOT NULL AND l.sold_at >= ${sql.raw(weekStartLit)}
      ) AS sold_days_listed
    FROM listings l
    WHERE l.model_id IS NOT NULL
      AND l.canonical_listing_id IS NULL
    GROUP BY 1, 2, 3, 4
    HAVING COUNT(*) FILTER (
      WHERE l.price_eur IS NOT NULL
        AND l.sold_at IS NULL
        AND l.removed_at IS NULL
    ) >= ${minCohortSize}
  `)) as unknown as Array<{
    model_id: number;
    region: string;
    year_bucket: string;
    mileage_bucket: string;
    active_prices: number[] | null;
    sold_this_week: number | string;
    sold_days_listed: number[] | null;
  }>;

  const modelsSeen = new Set<number>();
  // Pre-compute all snapshot rows so the whole batch lands in one transaction.
  // Mid-loop failure would otherwise leave the week half-written.
  const valuesToUpsert: Array<typeof marketSnapshots.$inferInsert> = [];
  for (const row of rows) {
    const prices = (row.active_prices ?? []).filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length < minCohortSize) continue;
    modelsSeen.add(row.model_id);

    const daysListed = (row.sold_days_listed ?? []).filter(
      (d): d is number => Number.isFinite(d) && d >= 0,
    );
    const inputs: SnapshotInput[] = prices.map((priceEur, i) => ({
      priceEur,
      daysListed: daysListed[i] ?? null,
    }));
    const stats = computeSnapshot(inputs);
    const soldThisWeek = Number(row.sold_this_week);

    valuesToUpsert.push({
      modelId: row.model_id,
      region: row.region,
      yearBucket: row.year_bucket,
      mileageBucket: row.mileage_bucket,
      period: 'week',
      capturedOn: weekStart,
      avgPriceEur: stats.avgPriceEur != null ? String(stats.avgPriceEur) : null,
      medianPriceEur: stats.medianPriceEur != null ? String(stats.medianPriceEur) : null,
      p25PriceEur: stats.p25PriceEur != null ? String(stats.p25PriceEur) : null,
      p75PriceEur: stats.p75PriceEur != null ? String(stats.p75PriceEur) : null,
      countActive: stats.countActive,
      countSold: soldThisWeek,
      daysToSellAvg: stats.daysToSellAvg != null ? String(stats.daysToSellAvg) : null,
    });
  }

  let upserted = 0;
  if (valuesToUpsert.length > 0) {
    await db.transaction(async (tx) => {
      for (const v of valuesToUpsert) {
        await tx
          .insert(marketSnapshots)
          .values(v)
          .onConflictDoUpdate({
            target: [
              marketSnapshots.modelId,
              marketSnapshots.region,
              marketSnapshots.yearBucket,
              marketSnapshots.mileageBucket,
              marketSnapshots.period,
              marketSnapshots.capturedOn,
            ],
            set: {
              avgPriceEur: sql`excluded.avg_price_eur`,
              medianPriceEur: sql`excluded.median_price_eur`,
              p25PriceEur: sql`excluded.p25_price_eur`,
              p75PriceEur: sql`excluded.p75_price_eur`,
              countActive: sql`excluded.count_active`,
              countSold: sql`excluded.count_sold`,
              daysToSellAvg: sql`excluded.days_to_sell_avg`,
              computedAt: sql`now()`,
            },
          });
        upserted++;
      }
    });
  }

  return {
    cohortsComputed: rows.length,
    rowsUpserted: upserted,
    modelsScanned: modelsSeen.size,
  };
}

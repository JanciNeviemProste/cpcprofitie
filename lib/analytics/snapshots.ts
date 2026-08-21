// Weekly market snapshot computation. For each (model, year-bucket,
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
import { plausiblePricedRaw, slovakMarketRaw } from './quality';

export type WeeklySnapshotStats = {
  cohortsComputed: number;
  rowsUpserted: number;
  modelsScanned: number;
  /** Cohorts that existed last run and no longer qualify — see the delete. */
  staleCohortsPurged: number;
};

export { isoWeekStart };

/**
 * Compute weekly snapshots for the current ISO week. Idempotent: re-running
 * for the same week overwrites the cohort's stats (PK is
 * model/region/year-bucket/mileage-bucket/period/captured-on, with region
 * always written as 'all' — see the note on the query below).
 *
 * Minimum cohort size: 3 listings. Below that, the snapshot is skipped — the
 * numbers would be noise. The UI filters by cohort size.
 */
export async function computeWeeklySnapshots(
  opts: {
    minCohortSize?: number;
    asOf?: Date;
  } = {},
): Promise<WeeklySnapshotStats> {
  const minCohortSize = opts.minCohortSize ?? 3;
  const asOf = opts.asOf ?? new Date();
  const weekStart = isoWeekStart(asOf);
  // Inline the timestamp literal — Drizzle's `${weekStart}` Date binding
  // intermittently fails type resolution inside ARRAY_AGG…FILTER expressions
  // (pg adapter sends ambiguous type). String literal + ::timestamptz cast
  // sidesteps it without changing semantics.
  const weekStartLit = `'${weekStart.toISOString()}'::timestamptz`;
  // Marks the boundary between rows this run refreshed and rows left over
  // from an earlier run of the same week. Taken before any write.
  const runStartedAt = new Date();
  const db = getDb();

  // One big SQL: group canonical listings by (model, year-bucket,
  // mileage-bucket) and pull the prices + days-listed arrays into JS so
  // computeSnapshot() (already unit-tested) does the actual math.
  //
  // Region is deliberately NOT a grouping dimension. Splitting by kraj left an
  // average of 1.5 cars per cohort — 38 961 cohorts of which only 1 255 held
  // five or more, covering 10 618 cars. Dropping it gives 6 821 cohorts, 2 429
  // usable, covering 51 535 — five times the coverage from the same data.
  // Used-car prices do not vary between kraje enough to pay for that, and the
  // Danish listings this gets compared against carry no region at all.
  //
  // The column stays and is written as 'all': it is part of the primary key
  // (migration 0002), and 'all' states plainly that the row is nationwide.
  // Region remains available as a filter in the UI, it just no longer splits
  // the cohort a median is computed from.
  const rows = (await db.execute(sql`
    SELECT
      l.model_id,
      -- No 'unknown' branch in either CASE: the WHERE clause below has already
      -- excluded every row that would land in one.
      CASE
        WHEN l.year >= 2020 THEN '2020+'
        WHEN l.year >= 2015 THEN '2015-19'
        WHEN l.year >= 2010 THEN '2010-14'
        ELSE '<2010'
      END AS year_bucket,
      CASE
        WHEN l.mileage_km < 50000 THEN '0-50k'
        WHEN l.mileage_km < 100000 THEN '50-100k'
        WHEN l.mileage_km < 150000 THEN '100-150k'
        ELSE '150k+'
      END AS mileage_bucket,
      ARRAY_AGG(l.price_eur::float8) FILTER (
        WHERE l.sold_at IS NULL
          AND l.removed_at IS NULL
          AND ${plausiblePricedRaw('l')}
      ) AS active_prices,
      COUNT(*) FILTER (WHERE l.sold_at IS NOT NULL AND l.sold_at >= ${sql.raw(weekStartLit)}) AS sold_this_week,
      ARRAY_AGG(
        -- From when we first had evidence the advert existed, not from when we
        -- imported the URL. first_seen_at is our discovery date: 87 648 of
        -- 87 917 rows were imported from a corpus that already existed, so a
        -- lifetime measured from it is bounded by how long we have been looking.
        (EXTRACT(EPOCH FROM (coalesce(l.sold_at, l.removed_at) - l.first_seen_alive_at)) / 86400.0)::float8
      ) FILTER (
        WHERE l.sold_at IS NOT NULL
          AND l.first_seen_alive_at IS NOT NULL
          AND l.sold_at >= ${sql.raw(weekStartLit)}
      ) AS sold_days_listed
    FROM listings l
    WHERE l.model_id IS NOT NULL
      AND l.canonical_listing_id IS NULL
      -- Parts carry a brand and model in their title, so the catalog files a
      -- bumper as an Octavia. They never reach DealScore, which needs a year
      -- and a mileage, but they reach here: a EUR 100 door joins a cohort and
      -- moves its median.
      AND l.is_vehicle = true
      -- This snapshot IS the Slovak price reference, so a Czech car does not
      -- belong in the cohort at all — not merely out of its median. The guard
      -- sits here rather than inside marketReferenceRaw because this query
      -- splits its conditions between WHERE and FILTER: sold rows must survive
      -- the WHERE to be counted, so the price bounds cannot move up here.
      AND ${slovakMarketRaw('l')}
      -- A car with no year or no mileage cannot be compared to anything. The
      -- CASEs above bucket both as 'unknown', which quietly gathers a 1998
      -- hatchback and a 2024 estate into one cohort and calls their midpoint a
      -- market price. Dropping them costs coverage and buys a median that
      -- means what it says.
      AND l.year IS NOT NULL
      AND l.mileage_km IS NOT NULL
      AND l.mileage_km >= 0
    GROUP BY 1, 2, 3
    HAVING COUNT(*) FILTER (
      WHERE l.sold_at IS NULL
        AND l.removed_at IS NULL
        AND ${plausiblePricedRaw('l')}
    ) >= ${minCohortSize}
  `)) as unknown as Array<{
    model_id: number;
    year_bucket: string;
    mileage_bucket: string;
    active_prices: unknown;
    sold_this_week: number | string;
    sold_days_listed: unknown;
  }>;

  const modelsSeen = new Set<number>();
  // Pre-compute all snapshot rows so the whole batch lands in one transaction.
  // Mid-loop failure would otherwise leave the week half-written.
  const valuesToUpsert: Array<typeof marketSnapshots.$inferInsert> = [];
  for (const row of rows) {
    const prices = toNumberArray(row.active_prices).filter((p) => p > 0);
    if (prices.length < minCohortSize) continue;
    modelsSeen.add(row.model_id);

    // Passed separately, not zipped. Pairing the n-th active price with the
    // n-th sale matched two unrelated lists and truncated to the shorter one.
    const daysListed = toNumberArray(row.sold_days_listed).filter((d) => d >= 0);
    const inputs: SnapshotInput[] = prices.map((priceEur) => ({ priceEur, daysListed: null }));
    const stats = computeSnapshot(inputs, daysListed);
    const soldThisWeek = Number(row.sold_this_week);

    valuesToUpsert.push({
      modelId: row.model_id,
      region: 'all',
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

  // Drop cohorts that no longer qualify this week.
  //
  // The upsert alone never removes anything, so a cohort that falls below the
  // floor — or stops existing — keeps serving whatever median it last had.
  // That stayed invisible while cohorts rarely vanished; scoping the reference
  // to the Slovak market retired 742 of them at once, of which 274 were still
  // above the publish floor and still being served with their old,
  // Czech-contaminated medians.
  //
  // Scoped to this week's captured_on only. Earlier weeks are measurements of
  // a week that cannot be recomputed and are never touched.
  const purged = await db.execute(sql`
    DELETE FROM market_snapshots
    WHERE captured_on = ${sql.raw(weekStartLit)}
      AND period = 'week'
      AND computed_at < ${runStartedAt}
  `);

  return {
    cohortsComputed: rows.length,
    rowsUpserted: upserted,
    modelsScanned: modelsSeen.size,
    staleCohortsPurged: (purged as unknown as { count?: number }).count ?? 0,
  };
}

/**
 * Normalise an aggregated Postgres array into numbers.
 *
 * ARRAY_AGG of float8 arrives as a JS array, but numeric[] does not — it comes
 * back as the raw literal "{1.5,2.5}", and calling .filter on it threw
 * "(e.sold_days_listed ?? []).filter is not a function", which failed the whole
 * weekly snapshot step while the surrounding cron reported success. Accept both
 * shapes rather than trusting the driver to be consistent.
 */
export function toNumberArray(value: unknown): number[] {
  if (value == null) return [];
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.replace(/^{|}$/g, '').split(',')
      : [];
  return (
    raw
      .map((v) => (typeof v === 'number' ? v : String(v).trim()))
      // "{}" splits to [""] and Number("") is 0, not NaN — an empty aggregate
      // would otherwise become a single zero-day sale.
      .filter((v) => v !== '' && v !== 'NULL')
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => Number.isFinite(n))
  );
}

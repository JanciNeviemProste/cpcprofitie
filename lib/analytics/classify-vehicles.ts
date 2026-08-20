// Mark listings that are car parts, not cars. See lib/scraping/is-vehicle.ts
// for what counts as which and why the rule is deliberately narrow.
//
// Runs over raw_title only, so like the year backfill it needs no crawling.
// Bounded per call and cursor-driven; on a dry run it writes nothing and
// reports what it would have done.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { isVehicleTitle } from '@/lib/scraping/is-vehicle';

export type ClassifyVehiclesStats = {
  scanned: number;
  /** Titles this run judged to be parts. */
  flagged: number;
  updated: number;
  remaining: number;
  dryRun: boolean;
  /** Flagged listings that carry BOTH a year and a mileage. A part almost never
   *  has either, so this is the false-positive estimate — the number that has
   *  to stay near zero, because a wrongly flagged car leaves the market for
   *  good and nothing re-examines it. */
  flaggedWithYearAndKm: number;
  /** Dry run only: flagged titles to read before committing to them. */
  sample?: string[];
  /** Dry run only: the flagged titles that look most like real cars. */
  suspiciousSample?: string[];
  nextCursor: string | null;
};

export async function classifyVehicles(
  opts: { limit?: number; dryRun?: boolean; afterId?: bigint } = {},
): Promise<ClassifyVehiclesStats> {
  const limit = Math.min(20_000, Math.max(1, opts.limit ?? 10_000));
  const dryRun = opts.dryRun ?? false;
  const db = getDb();
  const stats: ClassifyVehiclesStats = {
    scanned: 0,
    flagged: 0,
    updated: 0,
    remaining: 0,
    dryRun,
    flaggedWithYearAndKm: 0,
    nextCursor: null,
  };

  try {
    // Only listings still marked as vehicles: this never reinstates one, so a
    // manual correction in the database is not undone by the next run.
    const rows = (await db.execute(sql`
      SELECT id, raw_title, year, mileage_km
      FROM listings
      WHERE is_vehicle = true
        AND raw_title IS NOT NULL
        ${opts.afterId != null ? sql`AND id > ${opts.afterId.toString()}::bigint` : sql``}
      ORDER BY id
      LIMIT ${limit}
    `)) as unknown as Array<{
      id: string | number | bigint;
      raw_title: string;
      year: number | null;
      mileage_km: number | null;
    }>;

    stats.scanned = rows.length;
    if (rows.length > 0) {
      const last = rows[rows.length - 1]!.id;
      stats.nextCursor = typeof last === 'bigint' ? last.toString() : String(last);
    }

    const partIds: string[] = [];
    const sample: string[] = [];
    const suspicious: string[] = [];
    for (const r of rows) {
      if (isVehicleTitle(r.raw_title)) continue;
      stats.flagged++;
      partIds.push(typeof r.id === 'bigint' ? r.id.toString() : String(r.id));
      if (r.year != null && r.mileage_km != null) {
        stats.flaggedWithYearAndKm++;
        if (suspicious.length < 30) suspicious.push(r.raw_title);
      }
      // Spread across the batch: consecutive ids are one seller's listings, all
      // phrased the same way, which would make any sample look unanimous.
      if (dryRun && stats.flagged % 25 === 1 && sample.length < 30) sample.push(r.raw_title);
    }

    if (dryRun) {
      stats.sample = sample;
      stats.suspiciousSample = suspicious;
    } else if (partIds.length > 0) {
      const updated = await db.execute(sql`
        UPDATE listings SET is_vehicle = false
        WHERE id IN (${sql.join(
          partIds.map((id) => sql`${id}::bigint`),
          sql`, `,
        )})
        RETURNING id
      `);
      stats.updated = (updated as unknown as unknown[]).length;
    }

    const remainingRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM listings
      WHERE is_vehicle = true AND raw_title IS NOT NULL
        ${stats.nextCursor != null ? sql`AND id > ${stats.nextCursor}::bigint` : sql``}
    `)) as unknown as Array<{ n: number }>;
    stats.remaining = remainingRows[0]?.n ?? 0;

    return stats;
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'classify-vehicles' } });
    throw e;
  }
}

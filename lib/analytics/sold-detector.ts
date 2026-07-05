// Sold detection heuristic.
//
// A listing is considered "sold" when:
//   - removed_at IS NOT NULL (URL returned 404/410)
//   - canonical_listing_id IS NULL (it's not a known repost clone)
//   - no other listing with the same fingerprint + source appeared within
//     30 days after removed_at (otherwise it's most likely a relisting)
//
// When we decide it's sold we set sold_at = removed_at. Otherwise we leave
// sold_at NULL so the listing stays out of "days-to-sell" analytics.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { listings } from '@/lib/db/schema';

export type SoldDetectorStats = {
  scanned: number;
  markedSold: number;
  keptRelisted: number;
  errors: number;
};

type CandidateRow = {
  id: string | number | bigint;
  source: string;
  fingerprint: string | null;
  removed_at: string | Date;
};

export async function detectSoldListings(
  opts: { batchSize?: number; maxBatches?: number } = {},
): Promise<SoldDetectorStats> {
  const batchSize = opts.batchSize ?? 500;
  const maxBatches = opts.maxBatches ?? 20;
  const db = getDb();
  const stats: SoldDetectorStats = {
    scanned: 0,
    markedSold: 0,
    keptRelisted: 0,
    errors: 0,
  };

  // We iterate by id ascending and advance `cursor` so each batch processes a
  // distinct slice. Because we either set sold_at or leave it NULL forever
  // (relisting verdict is stable once removed_at is fixed), rows we touched
  // in a previous batch won't show up again — but using a cursor avoids
  // unbounded OFFSETs and keeps progress deterministic if we crash midway.
  let cursor = BigInt(0);

  for (let batchNum = 0; batchNum < maxBatches; batchNum++) {
    let rows: CandidateRow[];
    try {
      const result = await db.execute(sql`
        SELECT id, source, fingerprint, removed_at
        FROM ${listings}
        WHERE removed_at IS NOT NULL
          AND sold_at IS NULL
          AND canonical_listing_id IS NULL
          AND id > ${cursor.toString()}::bigint
        ORDER BY id ASC
        LIMIT ${batchSize}
      `);
      rows = result as unknown as CandidateRow[];
    } catch (e) {
      stats.errors++;
      Sentry.captureException(e, {
        tags: { component: 'sold-detector', step: 'loadBatch' },
      });
      break;
    }

    if (rows.length === 0) break;

    stats.scanned += rows.length;
    const idFragments = rows.map((row) => {
      const idStr = typeof row.id === 'bigint' ? row.id.toString() : String(row.id);
      const idBig = BigInt(idStr);
      if (idBig > cursor) cursor = idBig;
      return sql`${idStr}::bigint`;
    });

    // One set-based UPDATE per batch (was: SELECT + UPDATE per row, up to
    // ~20k queries/run). "Sold" = no relisting with the same fingerprint +
    // source within 30 days after removal; no fingerprint = can't prove a
    // relisting, treat as sold.
    try {
      const marked = await db.execute(sql`
        UPDATE ${listings} l
        SET sold_at = l.removed_at
        WHERE l.id IN (${sql.join(idFragments, sql`, `)})
          AND l.sold_at IS NULL
          AND l.removed_at IS NOT NULL
          AND (
            l.fingerprint IS NULL
            OR NOT EXISTS (
              SELECT 1
              FROM ${listings} r
              WHERE r.fingerprint = l.fingerprint
                AND r.id <> l.id
                AND r.source = l.source
                AND r.first_seen_at BETWEEN l.removed_at
                  AND (l.removed_at + interval '30 days')
            )
          )
        RETURNING l.id
      `);
      const markedCount = (marked as unknown as unknown[]).length;
      stats.markedSold += markedCount;
      stats.keptRelisted += rows.length - markedCount;
    } catch (e) {
      stats.errors++;
      Sentry.captureException(e, {
        tags: { component: 'sold-detector', step: 'processBatch' },
      });
    }

    console.log(
      `[sold-detector] batch ${batchNum + 1}/${maxBatches} scanned=${stats.scanned} sold=${stats.markedSold} relisted=${stats.keptRelisted} errors=${stats.errors}`,
    );

    if (rows.length < batchSize) break;
  }

  return stats;
}

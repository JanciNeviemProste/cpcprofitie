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

    for (const row of rows) {
      stats.scanned++;
      try {
        // Advance cursor regardless of outcome.
        const idStr = typeof row.id === 'bigint' ? row.id.toString() : String(row.id);
        const idBig = BigInt(idStr);
        if (idBig > cursor) cursor = idBig;

        if (!row.fingerprint) {
          // No fingerprint → can't prove relisting, treat as sold.
          await db.execute(sql`
            UPDATE ${listings}
            SET sold_at = removed_at
            WHERE id = ${idStr}::bigint AND sold_at IS NULL AND removed_at IS NOT NULL
          `);
          stats.markedSold++;
          continue;
        }

        const relistedResult = await db.execute(sql`
          SELECT 1
          FROM ${listings}
          WHERE fingerprint = ${row.fingerprint}
            AND id <> ${idStr}::bigint
            AND source = ${row.source}
            AND first_seen_at BETWEEN ${row.removed_at as unknown as string}::timestamptz
              AND (${row.removed_at as unknown as string}::timestamptz + interval '30 days')
          LIMIT 1
        `);
        const relisted = (relistedResult as unknown as unknown[]).length > 0;

        if (relisted) {
          stats.keptRelisted++;
        } else {
          await db.execute(sql`
            UPDATE ${listings}
            SET sold_at = removed_at
            WHERE id = ${idStr}::bigint AND sold_at IS NULL AND removed_at IS NOT NULL
          `);
          stats.markedSold++;
        }
      } catch (e) {
        stats.errors++;
        Sentry.captureException(e, {
          tags: { component: 'sold-detector', step: 'processRow' },
        });
      }
    }

    console.log(
      `[sold-detector] batch ${batchNum + 1}/${maxBatches} scanned=${stats.scanned} sold=${stats.markedSold} relisted=${stats.keptRelisted} errors=${stats.errors}`,
    );

    if (rows.length < batchSize) break;
  }

  return stats;
}

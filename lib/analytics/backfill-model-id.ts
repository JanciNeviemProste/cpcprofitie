// One-off / repeatable backfill: resolve model_id for listings that have a
// raw_title but no model_id. These are historical rows scraped before the
// make/model parser matured — the live scrapers now populate model_id, but
// old rows that aren't in the re-scrape rotation stay NULL, which starves
// DealScore cohorts (they require model_id). Same parse logic as the live
// path (parseMakeModel → ensureModelId), so results are consistent.
//
// Safe: only fills NULLs, never overwrites an existing model_id. Bounded per
// run so it fits the cron budget; call repeatedly until `remaining` is 0.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { listings } from '@/lib/db/schema';
import { parseMakeModel } from '@/lib/scraping/normalize';
import { ensureModelId } from '@/lib/scraping/persist';

export type BackfillModelIdStats = {
  scanned: number;
  resolved: number;
  updated: number;
  remaining: number;
  dryRun: boolean;
};

export async function backfillModelId(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<BackfillModelIdStats> {
  const limit = Math.min(10_000, Math.max(1, opts.limit ?? 5000));
  const dryRun = opts.dryRun ?? false;
  const db = getDb();
  const stats: BackfillModelIdStats = { scanned: 0, resolved: 0, updated: 0, remaining: 0, dryRun };

  try {
    const rows = (await db.execute(sql`
      SELECT id, raw_title
      FROM listings
      WHERE model_id IS NULL
        AND raw_title IS NOT NULL
        AND canonical_listing_id IS NULL
        AND sold_at IS NULL
        AND removed_at IS NULL
      ORDER BY id
      LIMIT ${limit}
    `)) as unknown as Array<{ id: string | number | bigint; raw_title: string }>;

    stats.scanned = rows.length;

    // Group listing ids by the resolved model_id so we issue one UPDATE per
    // distinct model instead of one per row.
    const byModel = new Map<number, string[]>();
    for (const r of rows) {
      const { makeSlug, modelSlug } = parseMakeModel(r.raw_title);
      if (!modelSlug) continue;
      const modelId = await ensureModelId(makeSlug, modelSlug, r.raw_title);
      if (modelId == null) continue;
      stats.resolved++;
      const idStr = typeof r.id === 'bigint' ? r.id.toString() : String(r.id);
      const arr = byModel.get(modelId) ?? [];
      arr.push(idStr);
      byModel.set(modelId, arr);
    }

    if (!dryRun) {
      for (const [modelId, ids] of byModel) {
        // Re-check model_id IS NULL in the predicate so a concurrent scrape
        // that already set it wins — we never overwrite.
        const updated = await db.execute(sql`
          UPDATE listings
          SET model_id = ${modelId}
          WHERE model_id IS NULL
            AND id IN (${sql.join(
              ids.map((id) => sql`${id}::bigint`),
              sql`, `,
            )})
          RETURNING id
        `);
        stats.updated += (updated as unknown as unknown[]).length;
      }
    }

    const remainingRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM listings
      WHERE model_id IS NULL
        AND raw_title IS NOT NULL
        AND canonical_listing_id IS NULL
        AND sold_at IS NULL
        AND removed_at IS NULL
    `)) as unknown as Array<{ n: number }>;
    stats.remaining = remainingRows[0]?.n ?? 0;

    return stats;
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'backfill-model-id' } });
    throw e;
  }
}

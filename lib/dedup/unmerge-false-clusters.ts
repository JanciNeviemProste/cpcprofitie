// Undo merges that were never justified.
//
// 13 631 bazoš listings — 68% of the source — sat marked as duplicates of one
// another and were therefore invisible to every market query. They are not
// duplicates. One group held 681 Škoda Octavias, 2001 to 2024, EUR 2 499 to
// EUR 22 999; 515 groups held two or more different VINs, the worst of them 151.
//
// They were merged because the fingerprint they shared had been computed before
// any of them had data, when every field collapsed to the same sentinel. Now
// that fingerprints are recomputed from the row as it stands (see
// refreshFingerprints), a clone whose fingerprint no longer matches its
// canonical is a merge with nothing left holding it together.
//
// Deliberately not a blanket reset. resetCanonical() clears every
// canonical_listing_id, but the fingerprint pass only looks back 90 days, so
// every legitimate cluster older than that would be un-merged and never
// rebuilt — and since many of those rows carry removed_at, they would land
// straight in the sold-detector's candidate set and be stamped sold, which is
// irreversible. This clears only what it can show to be wrong.

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';

export type UnmergeStats = {
  scanned: number;
  /** Clones whose link to their canonical was cleared. */
  unmerged: number;
  dryRun: boolean;
  /** Dry run only: pairs that would be split, so the judgement can be checked
   *  by eye before 13 000 rows move. */
  sample?: Array<{
    cloneId: string;
    canonicalId: string;
    cloneTitle: string | null;
    canonicalTitle: string | null;
    clonePrice: string | null;
    canonicalPrice: string | null;
    cloneYear: number | null;
    canonicalYear: number | null;
  }>;
  nextCursor: string | null;
};

export async function unmergeFalseClusters(
  opts: { limit?: number; dryRun?: boolean; afterId?: bigint } = {},
): Promise<UnmergeStats> {
  const limit = Math.min(20_000, Math.max(1, opts.limit ?? 5_000));
  const dryRun = opts.dryRun ?? false;
  const db = getDb();
  const stats: UnmergeStats = { scanned: 0, unmerged: 0, dryRun, nextCursor: null };

  try {
    // The question is not "is this pair wrong" but "what still justifies it".
    // A merge survives only if a shared VIN vouches for it — direct evidence of
    // one physical car, which outranks everything — or both rows carry the same
    // non-null fingerprint. Everything else goes.
    //
    // Stating it that way round matters. The first version asked whether the
    // fingerprints were `IS DISTINCT FROM` each other, and two NULLs are not
    // distinct, so 7 660 merges survived — including the 681-Octavia group,
    // whose members had just had their meaningless fingerprints cleared. A row
    // with no identity cannot be shown to be a duplicate of anything; absence
    // of evidence on both sides is not evidence of sameness.
    const rows = (await db.execute(sql`
      SELECT
        l.id AS clone_id,
        c.id AS canonical_id,
        l.raw_title AS clone_title,
        c.raw_title AS canonical_title,
        l.price_eur::text AS clone_price,
        c.price_eur::text AS canonical_price,
        l.year AS clone_year,
        c.year AS canonical_year
      FROM listings l
      JOIN listings c ON c.id = l.canonical_listing_id
      WHERE (
          NOT (
            l.fingerprint IS NOT NULL
            AND c.fingerprint IS NOT NULL
            AND l.fingerprint = c.fingerprint
          )
          -- VIN outranks the fingerprint in both directions. A dealer listing
          -- four identically specced new Octavias gives all four the same
          -- fingerprint — same model, year, mileage bucket, seller — and they
          -- are four separate cars. Three such clusters survived the first pass
          -- because their hashes agreed.
          OR EXISTS (
            SELECT 1
            FROM listing_details dl, listing_details dc
            WHERE dl.listing_id = l.id
              AND dc.listing_id = c.id
              AND dl.vin IS NOT NULL AND LENGTH(dl.vin) = 17
              AND dc.vin IS NOT NULL AND LENGTH(dc.vin) = 17
              AND dl.vin <> dc.vin
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM listing_details d1
          JOIN listing_details d2 ON d1.vin = d2.vin
          WHERE d1.listing_id = l.id
            AND d2.listing_id = c.id
            AND d1.vin IS NOT NULL
            AND LENGTH(d1.vin) = 17
        )
        ${opts.afterId != null ? sql`AND l.id > ${opts.afterId.toString()}::bigint` : sql``}
      ORDER BY l.id
      LIMIT ${limit}
    `)) as unknown as Array<{
      clone_id: string | number | bigint;
      canonical_id: string | number | bigint;
      clone_title: string | null;
      canonical_title: string | null;
      clone_price: string | null;
      canonical_price: string | null;
      clone_year: number | null;
      canonical_year: number | null;
    }>;

    stats.scanned = rows.length;
    if (rows.length === 0) return stats;
    const asId = (v: string | number | bigint) => (typeof v === 'bigint' ? v.toString() : String(v));
    stats.nextCursor = asId(rows[rows.length - 1]!.clone_id);

    if (dryRun) {
      // Spread across the batch rather than the first 50: consecutive ids are
      // one seller's listings, and a sample of those would look far more
      // uniform than the data is.
      const step = Math.max(1, Math.floor(rows.length / 50));
      stats.sample = rows
        .filter((_, i) => i % step === 0)
        .slice(0, 50)
        .map((r) => ({
          cloneId: asId(r.clone_id),
          canonicalId: asId(r.canonical_id),
          cloneTitle: r.clone_title,
          canonicalTitle: r.canonical_title,
          clonePrice: r.clone_price,
          canonicalPrice: r.canonical_price,
          cloneYear: r.clone_year,
          canonicalYear: r.canonical_year,
        }));
      return stats;
    }

    const ids = rows.map((r) => asId(r.clone_id));
    const updated = await db.execute(sql`
      UPDATE listings
      SET canonical_listing_id = NULL
      WHERE id IN (${sql.join(
        ids.map((id) => sql`${id}::bigint`),
        sql`, `,
      )})
        AND canonical_listing_id IS NOT NULL
      RETURNING id
    `);
    stats.unmerged = (updated as unknown as unknown[]).length;

    return stats;
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'unmerge-false-clusters' } });
    throw e;
  }
}

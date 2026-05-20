// Repost clustering. After listings are upserted with a fingerprint (and
// optionally a VIN from detail enrichment), this pass groups duplicates and
// marks all non-canonical rows with canonical_listing_id pointing to the
// oldest member of the cluster.
//
// Matching strategy (strongest first):
//   1. Same VIN  → same physical car (gold standard, ~1% coverage today)
//   2. Same fingerprint within a 90-day window → same listing reposted
//
// Canonical = listing with the smallest firstSeenAt in the cluster. Once
// assigned, days-to-sell metrics anchor to the canonical's firstSeenAt rather
// than the newest repost.

import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { listingDetails, listings } from '@/lib/db/schema';

export type ClusterStats = {
  vinClusters: number;
  vinClonesAssigned: number;
  fingerprintClusters: number;
  fingerprintClonesAssigned: number;
};

/**
 * Mark non-canonical rows with canonical_listing_id. Idempotent — running it
 * twice produces the same final state. Designed to be called from the weekly
 * maintenance cron after fingerprints have been backfilled.
 */
export async function clusterReposts(opts: {
  windowDays?: number;
} = {}): Promise<ClusterStats> {
  const windowDays = opts.windowDays ?? 90;
  const db = getDb();
  const stats: ClusterStats = {
    vinClusters: 0,
    vinClonesAssigned: 0,
    fingerprintClusters: 0,
    fingerprintClonesAssigned: 0,
  };

  // ── Pass 1: VIN-based clustering ──
  // For every VIN that appears on 2+ listings, pick the oldest as canonical
  // and point every other listing in the cluster at it.
  const vinClusters = await db.execute(sql`
    WITH vin_groups AS (
      SELECT
        d.vin,
        MIN(l.id) FILTER (WHERE l.first_seen_at = grp.oldest) AS canonical_id,
        ARRAY_AGG(l.id) AS member_ids
      FROM ${listings} l
      JOIN ${listingDetails} d ON d.listing_id = l.id
      JOIN LATERAL (
        SELECT MIN(l2.first_seen_at) AS oldest
        FROM ${listings} l2
        JOIN ${listingDetails} d2 ON d2.listing_id = l2.id
        WHERE d2.vin = d.vin
      ) grp ON true
      WHERE d.vin IS NOT NULL AND LENGTH(d.vin) = 17
      GROUP BY d.vin, grp.oldest
      HAVING COUNT(*) > 1
    ),
    updates AS (
      UPDATE ${listings} l
      SET canonical_listing_id = vg.canonical_id
      FROM vin_groups vg
      WHERE l.id = ANY(vg.member_ids)
        AND l.id <> vg.canonical_id
        AND (l.canonical_listing_id IS DISTINCT FROM vg.canonical_id)
      RETURNING l.id
    )
    SELECT
      (SELECT COUNT(*) FROM vin_groups) AS clusters,
      (SELECT COUNT(*) FROM updates) AS clones_assigned
  `);
  const vinRow = (vinClusters as unknown as Array<Record<string, unknown>>)[0] as
    | { clusters: number | string; clones_assigned: number | string }
    | undefined;
  if (vinRow) {
    stats.vinClusters = Number(vinRow.clusters);
    stats.vinClonesAssigned = Number(vinRow.clones_assigned);
  }

  // ── Pass 2: Fingerprint-based clustering for listings WITHOUT a VIN match ──
  // Only consider listings that aren't already pinned by VIN (canonical_listing_id IS NULL)
  // and have a fingerprint. Window restricts how far back we look so old reposts
  // don't keep getting re-clustered forever.
  const fpClusters = await db.execute(sql`
    WITH fp_groups AS (
      SELECT
        l.fingerprint,
        MIN(l.first_seen_at) AS oldest,
        ARRAY_AGG(l.id ORDER BY l.first_seen_at ASC) AS member_ids
      FROM ${listings} l
      WHERE l.fingerprint IS NOT NULL
        AND l.canonical_listing_id IS NULL
        AND l.first_seen_at > now() - (${windowDays}::int * interval '1 day')
      GROUP BY l.fingerprint
      HAVING COUNT(*) > 1
    ),
    canonical_picks AS (
      SELECT
        fp_groups.fingerprint,
        fp_groups.member_ids[1] AS canonical_id,
        fp_groups.member_ids
      FROM fp_groups
    ),
    updates AS (
      UPDATE ${listings} l
      SET canonical_listing_id = cp.canonical_id
      FROM canonical_picks cp
      WHERE l.id = ANY(cp.member_ids)
        AND l.id <> cp.canonical_id
        AND l.canonical_listing_id IS NULL
      RETURNING l.id
    )
    SELECT
      (SELECT COUNT(*) FROM fp_groups) AS clusters,
      (SELECT COUNT(*) FROM updates) AS clones_assigned
  `);
  const fpRow = (fpClusters as unknown as Array<Record<string, unknown>>)[0] as
    | { clusters: number | string; clones_assigned: number | string }
    | undefined;
  if (fpRow) {
    stats.fingerprintClusters = Number(fpRow.clusters);
    stats.fingerprintClonesAssigned = Number(fpRow.clones_assigned);
  }

  return stats;
}

/**
 * Compute fingerprints for listings that don't have one yet. Uses listing
 * fields + (when available) detail.sellerName + first photo URL. Returns the
 * number of rows updated.
 */
export async function backfillFingerprints(opts: { limit?: number } = {}): Promise<number> {
  const limit = opts.limit ?? 10_000;
  const db = getDb();

  // Pull a batch of listings without a fingerprint, joined with their seller +
  // first photo when available. Doing this in TS rather than pure SQL because
  // computeFingerprint() encodes normalization rules we want unit-tested.
  const rows = await db.execute(sql`
    SELECT
      l.id,
      vm.slug AS make_slug,
      vmd.slug AS model_slug,
      l.year,
      l.mileage_km,
      l.region,
      d.seller_name,
      (SELECT url FROM listing_photos WHERE listing_id = l.id ORDER BY position ASC LIMIT 1) AS first_photo_url
    FROM ${listings} l
    LEFT JOIN listing_details d ON d.listing_id = l.id
    LEFT JOIN vehicle_models vmd ON vmd.id = l.model_id
    LEFT JOIN vehicle_makes vm ON vm.id = vmd.make_id
    WHERE l.fingerprint IS NULL
    LIMIT ${limit}
  `);

  const { computeFingerprint } = await import('./fingerprint');
  const batch = rows as unknown as Array<{
    id: string | number | bigint;
    make_slug: string | null;
    model_slug: string | null;
    year: number | null;
    mileage_km: number | null;
    region: string | null;
    seller_name: string | null;
    first_photo_url: string | null;
  }>;

  let updated = 0;
  for (const r of batch) {
    const fp = computeFingerprint({
      makeSlug: r.make_slug,
      modelSlug: r.model_slug,
      year: r.year,
      mileageKm: r.mileage_km,
      region: r.region,
      sellerName: r.seller_name,
      firstPhotoUrl: r.first_photo_url,
    });
    await db
      .update(listings)
      .set({ fingerprint: fp })
      .where(and(eq(listings.id, BigInt(r.id as number)), isNull(listings.fingerprint)));
    updated++;
  }
  return updated;
}

/** Count active canonical listings (not sold, not removed, not a repost-clone). */
export async function countActiveCanonical(): Promise<number> {
  const db = getDb();
  const result = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .where(
      and(
        isNull(listings.canonicalListingId),
        isNull(listings.soldAt),
        isNull(listings.removedAt),
        isNotNull(listings.fingerprint),
      ),
    );
  return result[0]?.n ?? 0;
}

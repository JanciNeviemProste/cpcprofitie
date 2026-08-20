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

import { and, isNotNull, isNull, sql } from 'drizzle-orm';
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
  // and point every other listing in the cluster at it. Window functions
  // (PARTITION BY vin) instead of a correlated LATERAL — the LATERAL was
  // O(n²) and timed out on a full-corpus recluster; this is O(n log n).
  const vinClusters = await db.execute(sql`
    WITH vin_members AS (
      SELECT
        l.id,
        d.vin,
        FIRST_VALUE(l.id) OVER (
          PARTITION BY d.vin ORDER BY l.first_seen_at ASC, l.id ASC
        ) AS canonical_id,
        COUNT(*) OVER (PARTITION BY d.vin) AS grp_size
      FROM ${listings} l
      JOIN ${listingDetails} d ON d.listing_id = l.id
      WHERE d.vin IS NOT NULL AND LENGTH(d.vin) = 17
    ),
    -- A listing chosen as canonical must not itself still point at something
    -- else, or the cluster head is invisible: every consumer reads
    -- canonical_listing_id IS NULL as "this is the canonical row", so a chain
    -- A → X → Y hides X from the market and makes maxClusterSize under-report.
    -- 1 396 rows were in that state. Runs before the assignment below so the
    -- head is cleared even when nothing else about the cluster changes.
    heads AS (
      UPDATE ${listings} l
      SET canonical_listing_id = NULL
      FROM vin_members vm
      WHERE l.id = vm.canonical_id
        AND vm.grp_size > 1
        AND l.canonical_listing_id IS NOT NULL
      RETURNING l.id
    ),
    updates AS (
      UPDATE ${listings} l
      SET canonical_listing_id = vm.canonical_id
      FROM vin_members vm
      WHERE l.id = vm.id
        AND vm.grp_size > 1
        AND l.id <> vm.canonical_id
        AND (l.canonical_listing_id IS DISTINCT FROM vm.canonical_id)
      RETURNING l.id
    )
    SELECT
      (SELECT COUNT(DISTINCT vin) FROM vin_members WHERE grp_size > 1) AS clusters,
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
    WITH vin_conflicts AS (
      -- Fingerprints that two different physical cars share. A VIN identifies
      -- the car itself, so two known and different VINs under one hash are
      -- proof that it is not one car being reposted — whatever the hash says.
      -- One "duplicate" group held 151 distinct VINs before this existed.
      --
      -- Unknown VINs veto nothing: coverage is around 1%, and absence of a VIN
      -- is not evidence of anything. Computed once here rather than per group,
      -- which would make the pass quadratic.
      SELECT l.fingerprint
      FROM ${listings} l
      JOIN ${listingDetails} d ON d.listing_id = l.id
      WHERE l.fingerprint IS NOT NULL
        AND d.vin IS NOT NULL AND LENGTH(d.vin) = 17
      GROUP BY l.fingerprint
      HAVING COUNT(DISTINCT d.vin) > 1
    ),
    fp_groups AS (
      SELECT
        l.fingerprint,
        MIN(l.first_seen_at) AS oldest,
        -- The id tiebreak is not decoration. first_seen_at defaults to now()
        -- for a whole batch insert, so ties are the common case, and without
        -- it the canonical pick — and therefore which listing the market sees
        -- — changes from run to run. The VIN pass above already orders this
        -- way; this one did not.
        ARRAY_AGG(l.id ORDER BY l.first_seen_at ASC, l.id ASC) AS member_ids
      FROM ${listings} l
      WHERE l.fingerprint IS NOT NULL
        AND l.canonical_listing_id IS NULL
        AND l.first_seen_at > now() - (${windowDays}::int * interval '1 day')
        -- Only cluster well-identified listings. This guard was added after the
        -- first false-merge and did not hold, because it tests the row as it
        -- stands while the stored hash was computed from an emptier version of
        -- the same row. The real defence now lives in computeFingerprint, which
        -- returns NULL rather than a hash shared by every listing that knows
        -- nothing about itself; the condition above (fingerprint IS NOT NULL)
        -- is what keeps those out. This stays as a second line.
        AND l.model_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM listing_photos p WHERE p.listing_id = l.id)
        AND l.fingerprint NOT IN (SELECT fingerprint FROM vin_conflicts)
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

export type RefreshFingerprintsStats = {
  scanned: number;
  /** Rows whose stored fingerprint did not match the recomputed one. */
  changed: number;
  /** Of those, rows that lost their fingerprint because it was never an
   *  identity in the first place. */
  cleared: number;
  dryRun: boolean;
  /** Dry run only: what would change, and why it is different. */
  sample?: Array<{ id: string; before: string | null; after: string | null; title: string | null }>;
  nextCursor: string | null;
};

/**
 * Recompute fingerprints from the data as it stands now, and write back the
 * ones that changed.
 *
 * This replaces backfillFingerprints, which only ever looked at rows
 * `WHERE fingerprint IS NULL`. Since persist.ts writes a fingerprint at scrape
 * time and pins it with `coalesce(existing, excluded)`, no row was ever null,
 * so the promised "recompute after enrichment with seller and photo" never ran
 * once: the weekly job reported `updated: 0` week after week while 13 631
 * listings sat merged under hashes computed before they had any data.
 *
 * That is the failure this function exists to make impossible. A fingerprint is
 * a function of the row, so it has to be recomputed when the row changes —
 * treating it as write-once means the guard in clusterReposts validates today's
 * data against a hash derived from an emptier version of it, which is exactly
 * how 681 different Octavias ended up in one cluster.
 *
 * Bounded and cursor-driven so a caller can walk the corpus without holding a
 * connection open, and set-based so a full walk is tens of statements rather
 * than tens of thousands.
 */
export async function refreshFingerprints(
  opts: {
    limit?: number;
    afterId?: bigint;
    dryRun?: boolean;
    /** Visit only rows whose inputs could have moved since the last weekly run.
     *  A full walk is 88 000 rows and does not fit one cron invocation, so
     *  without this the weekly job would recompute the same lowest 10 000 ids
     *  every week and never reach the rest. */
    staleSinceDays?: number;
  } = {},
): Promise<RefreshFingerprintsStats> {
  const limit = Math.min(20_000, Math.max(1, opts.limit ?? 5_000));
  const dryRun = opts.dryRun ?? false;
  const staleDays = opts.staleSinceDays;
  const db = getDb();
  const stats: RefreshFingerprintsStats = {
    scanned: 0,
    changed: 0,
    cleared: 0,
    dryRun,
    nextCursor: null,
  };

  // Every row, not just the null ones — see above. Computing in TS rather than
  // SQL because computeFingerprint encodes normalization (diacritics, photo
  // identity, bucket edges) that is unit-tested and must not be restated in a
  // second dialect where it can drift.
  const rows = (await db.execute(sql`
    SELECT
      l.id,
      l.source,
      l.source_id,
      l.raw_title,
      l.fingerprint AS stored,
      vm.slug AS make_slug,
      vmd.slug AS model_slug,
      l.year,
      l.mileage_km,
      l.region,
      d.seller_name,
      (SELECT url FROM listing_photos WHERE listing_id = l.id ORDER BY position ASC LIMIT 1)
        AS first_photo_url
    FROM ${listings} l
    LEFT JOIN listing_details d ON d.listing_id = l.id
    LEFT JOIN vehicle_models vmd ON vmd.id = l.model_id
    LEFT JOIN vehicle_makes vm ON vm.id = vmd.make_id
    WHERE TRUE
      ${opts.afterId != null ? sql`AND l.id > ${opts.afterId.toString()}::bigint` : sql``}
      ${
        staleDays != null
          ? sql`AND (
              l.fingerprint IS NULL
              OR l.last_seen_at > now() - (${staleDays}::int * interval '1 day')
              OR d.detailed_at > now() - (${staleDays}::int * interval '1 day')
            )`
          : sql``
      }
    ORDER BY l.id
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: string | number | bigint;
    source: string;
    source_id: string;
    raw_title: string | null;
    stored: string | null;
    make_slug: string | null;
    model_slug: string | null;
    year: number | null;
    mileage_km: number | null;
    region: string | null;
    seller_name: string | null;
    first_photo_url: string | null;
  }>;

  stats.scanned = rows.length;
  if (rows.length === 0) return stats;
  const last = rows[rows.length - 1]!.id;
  stats.nextCursor = typeof last === 'bigint' ? last.toString() : String(last);

  const { computeFingerprint } = await import('./fingerprint');
  const pending: Array<{ id: string; fp: string | null }> = [];
  const sample: NonNullable<RefreshFingerprintsStats['sample']> = [];

  for (const r of rows) {
    const fp = computeFingerprint({
      source: r.source,
      sourceId: r.source_id,
      makeSlug: r.make_slug,
      modelSlug: r.model_slug,
      year: r.year,
      mileageKm: r.mileage_km,
      region: r.region,
      sellerName: r.seller_name,
      firstPhotoUrl: r.first_photo_url,
    });
    if (fp === r.stored) continue;
    stats.changed++;
    if (fp === null) stats.cleared++;
    const idStr = typeof r.id === 'bigint' ? r.id.toString() : String(r.id);
    pending.push({ id: idStr, fp });
    // Spread across the batch: consecutive ids are one seller's listings in one
    // format, which would make any sample look unanimous.
    if (dryRun && stats.changed % 40 === 1 && sample.length < 25) {
      sample.push({ id: idStr, before: r.stored, after: fp, title: r.raw_title });
    }
  }

  if (dryRun) {
    stats.sample = sample;
    return stats;
  }

  // One statement per chunk instead of one per row. The casts are not optional:
  // without them Postgres types a VALUES list of literals as `unknown` and the
  // comparison against varchar fails.
  const CHUNK = 1_000;
  for (let i = 0; i < pending.length; i += CHUNK) {
    const slice = pending.slice(i, i + CHUNK);
    const tuples = slice.map(
      (p) => sql`(${p.id}::bigint, ${p.fp}::varchar(64))`,
    );
    await db.execute(sql`
      UPDATE ${listings} l
      SET fingerprint = v.fp
      FROM (VALUES ${sql.join(tuples, sql`, `)}) AS v(id, fp)
      WHERE l.id = v.id
        AND l.fingerprint IS DISTINCT FROM v.fp
    `);
  }

  return stats;
}

/**
 * @deprecated Superseded by refreshFingerprints, which recomputes rather than
 * only filling blanks. Kept for one release so a deploy that lands the new
 * cluster.ts before the new weekly-maintenance route does not break mid-roll.
 */
export async function backfillFingerprints(opts: { limit?: number } = {}): Promise<number> {
  // Eight days, not seven: the weekly cron must overlap itself, or a row
  // enriched moments after one run and untouched since would fall between two
  // windows and keep a stale fingerprint indefinitely.
  const stats = await refreshFingerprints({ limit: opts.limit, staleSinceDays: 8 });
  return stats.changed;
}

/**
 * Reset all repost clustering (canonical_listing_id → NULL). Used before a
 * full re-cluster to clear false-merges formed under the old (unguarded)
 * fingerprint pass. Returns rows reset. clusterReposts is idempotent, so
 * reset + clusterReposts recomputes the whole graph with the current guard.
 */
export async function resetCanonical(): Promise<number> {
  const db = getDb();
  const res = await db.execute(sql`
    UPDATE ${listings} SET canonical_listing_id = NULL
    WHERE canonical_listing_id IS NOT NULL
    RETURNING id
  `);
  return (res as unknown as unknown[]).length;
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

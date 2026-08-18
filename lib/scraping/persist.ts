// Persistence layer for scraper output. Batched upserts into the `listings`
// table and a row in `scrape_runs` per source per run. All operations are
// graceful no-ops when DATABASE_URL is unset so dev / preview builds don't
// crash.

import { and, eq, sql } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { getDb } from '@/lib/db';
import { isConnectionError, isDbKnownUnavailable, noteDbUnavailable } from '@/lib/db/errors';
import { hasDatabaseUrl } from '@/lib/db/url';
import {
  listingDetails,
  listingPhotos,
  listings,
  scrapeRuns,
  vehicleMakes,
  vehicleModels,
} from '@/lib/db/schema';
import { computeFingerprint } from '@/lib/dedup/fingerprint';
import type { NormalizedDetail, NormalizedListing, ScrapeResult, Source } from './types';

export type UpsertCounts = {
  added: number;
  updated: number;
  skipped: number;
  /** Last error message if any chunk fail occurred — for diagnostics. */
  lastError?: string;
};

const BATCH_SIZE = 50;

function hasDb(): boolean {
  return hasDatabaseUrl();
}

// Process-local cache so each scrape run doesn't hammer the DB resolving the
// same make/model on every listing. Vercel cold starts reset it — fine, that
// just means the first listing per slug per cold start pays the round trip.
const makeIdCache = new Map<string, number>();
const modelIdCache = new Map<string, number>();
// Slugs we already failed to resolve. Without this a query-level failure is
// retried (2-3 round trips) for every subsequent listing sharing the slug.
const unresolvableModelSlugs = new Set<string>();

/** How many model lookups may be in flight at once. Kept under the postgres.js
 *  default pool size (max: 10) so a large batch queues in our code rather than
 *  saturating the pool. */
const MODEL_RESOLVE_CONCURRENCY = 8;

/** Test seam — clears the in-process lookup caches between tests. */
export function __resetModelCache(): void {
  makeIdCache.clear();
  modelIdCache.clear();
  unresolvableModelSlugs.clear();
}

async function ensureMakeId(makeSlug: string): Promise<number | null> {
  const cached = makeIdCache.get(makeSlug);
  if (cached) return cached;
  try {
    const db = getDb();
    const found = await db
      .select({ id: vehicleMakes.id })
      .from(vehicleMakes)
      .where(eq(vehicleMakes.slug, makeSlug))
      .limit(1);
    if (found.length > 0) {
      makeIdCache.set(makeSlug, found[0]!.id);
      return found[0]!.id;
    }
    // Generate a stable-ish ID outside the seeded 1..15 range to avoid
    // collisions with curated seeds.
    const id = 1_000_000 + (hash32(makeSlug) & 0x7fffff);
    await db
      .insert(vehicleMakes)
      .values({ id, slug: makeSlug, name: toTitleCase(makeSlug) })
      .onConflictDoNothing({ target: vehicleMakes.slug });
    const refound = await db
      .select({ id: vehicleMakes.id })
      .from(vehicleMakes)
      .where(eq(vehicleMakes.slug, makeSlug))
      .limit(1);
    const finalId = refound[0]?.id ?? id;
    makeIdCache.set(makeSlug, finalId);
    return finalId;
  } catch (e) {
    if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'ensureMakeId', makeSlug });
    console.error('ensureMakeId_failed', {
      makeSlug,
      error: e instanceof Error ? e.message : e,
    });
    Sentry.captureException(e, {
      tags: { component: 'persist', step: 'ensureMakeId' },
      extra: { makeSlug },
    });
    return null;
  }
}

export async function ensureModelId(
  makeSlug: string | null,
  modelSlug: string | null,
  displayName: string | null,
): Promise<number | null> {
  if (!modelSlug) return null;
  const cached = modelIdCache.get(modelSlug);
  if (cached) return cached;
  if (unresolvableModelSlugs.has(modelSlug)) return null;
  if (!makeSlug) return null;
  try {
    const db = getDb();
    const found = await db
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.slug, modelSlug))
      .limit(1);
    if (found.length > 0) {
      modelIdCache.set(modelSlug, found[0]!.id);
      return found[0]!.id;
    }
    const makeId = await ensureMakeId(makeSlug);
    if (!makeId) {
      unresolvableModelSlugs.add(modelSlug);
      return null;
    }
    const id = 1_000_000 + (hash32(modelSlug) & 0x7fffff);
    await db
      .insert(vehicleModels)
      .values({
        id,
        makeId,
        slug: modelSlug,
        name: displayName ?? toTitleCase(modelSlug),
      })
      .onConflictDoNothing({ target: [vehicleModels.makeId, vehicleModels.slug] });
    const refound = await db
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.slug, modelSlug))
      .limit(1);
    const finalId = refound[0]?.id ?? id;
    modelIdCache.set(modelSlug, finalId);
    return finalId;
  } catch (e) {
    // An unreachable server is not a per-model problem: report it once and let
    // it abort the run instead of repeating for every remaining listing.
    if (isConnectionError(e)) {
      throw noteDbUnavailable(e, { step: 'ensureModelId', makeSlug, modelSlug });
    }
    console.error('ensureModelId_failed', {
      modelSlug,
      error: e instanceof Error ? e.message : e,
    });
    Sentry.captureException(e, {
      tags: { component: 'persist', step: 'ensureModelId' },
      extra: { makeSlug, modelSlug },
    });
    unresolvableModelSlugs.add(modelSlug);
    return null;
  }
}

/**
 * Resolve every distinct model slug in a batch to its ID.
 *
 * Previously this was `Promise.all(rows.map(...))`, which fired one lookup per
 * listing with no concurrency cap — hundreds of simultaneous queries against a
 * 10-connection pool, and hundreds of duplicate lookups for the same slug. It
 * also meant an outage produced one error per listing (CPCPROFIT-8).
 *
 * Deduplicating first cuts the query count by roughly an order of magnitude,
 * and the bounded workers let an outage stop the batch after the first failure
 * instead of after the last.
 */
async function resolveModelIds(rows: NormalizedListing[]): Promise<Map<string, number | null>> {
  const wanted = new Map<string, { makeSlug: string | null; displayName: string | null }>();
  for (const r of rows) {
    if (!r.modelSlug || wanted.has(r.modelSlug)) continue;
    wanted.set(r.modelSlug, { makeSlug: r.makeSlug, displayName: r.rawTitle });
  }

  const queue = [...wanted.entries()];
  const resolved = new Map<string, number | null>();
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      // Another worker already hit the outage — everything after this point
      // would fail identically, so stop rather than pile on.
      if (isDbKnownUnavailable()) return;
      const [modelSlug, meta] = queue[cursor++]!;
      resolved.set(modelSlug, await ensureModelId(meta.makeSlug, modelSlug, meta.displayName));
    }
  }

  // A rejecting worker (DbUnavailableError) propagates and aborts the batch.
  await Promise.all(
    Array.from({ length: Math.min(MODEL_RESOLVE_CONCURRENCY, queue.length) }, () => worker()),
  );
  return resolved;
}

export async function upsertListings(rows: NormalizedListing[]): Promise<UpsertCounts> {
  if (rows.length === 0) return { added: 0, updated: 0, skipped: 0 };
  if (!hasDb()) {
    return { added: 0, updated: 0, skipped: rows.length };
  }
  const db = getDb();
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let lastError: string | undefined;

  // Resolve all model IDs up front so the batch insert is one round trip per
  // chunk. Deduplicated and concurrency-capped — see resolveModelIds above.
  const modelIds = await resolveModelIds(rows);
  const resolved = rows.map((r) => {
    if (!r.sourceId || !r.url) return null;
    const modelId = (r.modelSlug ? modelIds.get(r.modelSlug) : null) ?? null;
    // Compute a weak fingerprint at upsert time using only listing-page
    // fields. After detail enrichment runs, backfillFingerprints() will
    // recompute with sellerName + first photo URL for stronger matching.
    const fingerprint = computeFingerprint({
      makeSlug: r.makeSlug,
      modelSlug: r.modelSlug,
      year: r.year,
      mileageKm: r.mileageKm,
      region: r.region,
      sellerName: null,
      firstPhotoUrl: null,
    });
    return {
      source: r.source,
      sourceId: r.sourceId,
      modelId,
      priceEur: r.priceEur != null ? String(r.priceEur) : null,
      year: r.year,
      mileageKm: r.mileageKm,
      fuel: r.fuel,
      transmission: r.transmission,
      region: r.region,
      rawTitle: r.rawTitle,
      url: r.url,
      rawJson: r.rawPayload,
      fingerprint,
      viewCount: r.viewCount ?? null,
      isFeatured: r.isFeatured === true,
      sellerPhone: r.sellerPhone ?? null,
    };
  });
  const resolvedRows = resolved.filter((r): r is NonNullable<typeof r> => r !== null);
  // Deduplicate by (source, sourceId): some sites return the same listings
  // across "different" paginated pages (e.g. autobazar.sk /inzeraty/?page=N
  // serves a server-rendered featured panel that ignores `page`). Postgres
  // ON CONFLICT cannot affect the same target row twice in one statement, so
  // duplicates within a batch would cause the whole chunk to fail.
  const seenKey = new Set<string>();
  const validRows: typeof resolvedRows = [];
  for (const r of resolvedRows) {
    const key = `${r.source}::${r.sourceId}`;
    if (seenKey.has(key)) continue;
    seenKey.add(key);
    validRows.push(r);
  }
  skipped += rows.length - validRows.length;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const chunk = validRows.slice(i, i + BATCH_SIZE);
    try {
      const result = await db
        .insert(listings)
        .values(chunk)
        .onConflictDoUpdate({
          target: [listings.source, listings.sourceId],
          set: {
            priceEur: sql`excluded.price_eur`,
            year: sql`excluded.year`,
            mileageKm: sql`excluded.mileage_km`,
            fuel: sql`excluded.fuel`,
            transmission: sql`excluded.transmission`,
            region: sql`excluded.region`,
            modelId: sql`excluded.model_id`,
            // Coalesce so a rescrape that fails to parse a title doesn't wipe
            // a previously good one. New non-null titles still win on update.
            rawTitle: sql`coalesce(excluded.raw_title, ${listings.rawTitle})`,
            url: sql`excluded.url`,
            rawJson: sql`excluded.raw_json`,
            lastSeenAt: sql`now()`,
            // Don't clobber a stronger fingerprint (computed post-enrichment)
            // with the weaker upsert-time one. Only set it when NULL.
            fingerprint: sql`coalesce(${listings.fingerprint}, excluded.fingerprint)`,
            // Engagement signals: view_count uses fresh non-null (counters go up),
            // is_featured is sticky-true (OR), seller_phone keeps first non-null.
            viewCount: sql`coalesce(excluded.view_count, ${listings.viewCount})`,
            isFeatured: sql`(${listings.isFeatured} OR excluded.is_featured)`,
            sellerPhone: sql`coalesce(${listings.sellerPhone}, excluded.seller_phone)`,
          },
        })
        .returning({
          id: listings.id,
          source: listings.source,
          sourceId: listings.sourceId,
          inserted: sql<boolean>`(xmax = 0)`,
        });
      for (const row of result) {
        if (row.inserted) added++;
        else updated++;
      }

      // Persist list-page thumbnails captured in rawPayload.thumbnailUrl.
      // ON CONFLICT DO NOTHING keeps existing rows — detail enrichment can
      // later replace the whole album with delete+insert.
      const thumbRows: Array<{ listingId: bigint; position: number; url: string }> = [];
      for (const inserted of result) {
        const original = chunk.find(
          (c) => c.source === inserted.source && c.sourceId === inserted.sourceId,
        );
        const thumb = original?.rawJson?.thumbnailUrl;
        if (typeof thumb !== 'string' || thumb.length === 0) continue;
        thumbRows.push({ listingId: inserted.id, position: 1, url: thumb.slice(0, 2000) });
      }
      if (thumbRows.length > 0) {
        await db
          .insert(listingPhotos)
          .values(thumbRows)
          .onConflictDoNothing({ target: [listingPhotos.listingId, listingPhotos.position] });
      }
    } catch (e) {
      // Otherwise an outage silently inflates `skipped` and the run "succeeds".
      if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'upsertListings' });
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('listings_batch_upsert_failed', {
        chunkSize: chunk.length,
        firstSourceId: chunk[0]?.sourceId,
        firstSource: chunk[0]?.source,
        firstRow: JSON.stringify(chunk[0]),
        error: errMsg,
        stack: e instanceof Error ? e.stack?.slice(0, 500) : undefined,
      });
      // Surface DB-level failures (schema drift, FK violation, etc.) to Sentry.
      // Without this they hide as "skipped" counts and never alert.
      Sentry.captureException(e, {
        tags: { component: 'persist', step: 'upsertListings' },
        extra: { chunkSize: chunk.length, firstSource: chunk[0]?.source },
      });
      skipped += chunk.length;
      lastError = errMsg;
    }
  }
  return { added, updated, skipped, lastError };
}

export async function recordScrapeRun(
  source: Source,
  result: ScrapeResult,
  counts: UpsertCounts,
): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    const combinedErrors: string[] = [];
    if (result.errors.length > 0) combinedErrors.push(...result.errors.slice(0, 5));
    if (counts.lastError) combinedErrors.push(`upsert: ${counts.lastError}`);
    await db.insert(scrapeRuns).values({
      source,
      status: result.errors.length === 0 && !counts.lastError ? 'succeeded' : 'failed',
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      listingsAdded: counts.added,
      listingsUpdated: counts.updated,
      errorMessage: combinedErrors.length > 0 ? combinedErrors.join('; ') : null,
    });
  } catch (e) {
    if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'recordScrapeRun', source });
    console.error('scrape_run_record_failed', e instanceof Error ? e.message : e);
    // Lost audit trail without alerting blinds us to schema-drift-style bugs.
    Sentry.captureException(e, {
      tags: { component: 'persist', step: 'recordScrapeRun' },
      extra: { source },
    });
  }
}

// ─── Detail enrichment persistence ──────────────────────────────────────────

export type DetailUpsertCounts = {
  detailsUpserted: number;
  photosInserted: number;
  skipped: number;
};

/** Resolve a (source, sourceId) pair to the listings.id. Cached per-process. */
const listingIdCache = new Map<string, bigint>();

function listingKey(source: Source, sourceId: string): string {
  return `${source}::${sourceId}`;
}

async function resolveListingId(source: Source, sourceId: string): Promise<bigint | null> {
  const key = listingKey(source, sourceId);
  const cached = listingIdCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const db = getDb();
    const rows = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.source, source), eq(listings.sourceId, sourceId)))
      .limit(1);
    const id = rows[0]?.id ?? null;
    if (id !== null) listingIdCache.set(key, id);
    return id;
  } catch (e) {
    if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'resolveListingId', source });
    console.error('resolveListingId_failed', {
      source,
      sourceId,
      error: e instanceof Error ? e.message : e,
    });
    return null;
  }
}

export async function persistDetails(details: NormalizedDetail[]): Promise<DetailUpsertCounts> {
  if (details.length === 0) return { detailsUpserted: 0, photosInserted: 0, skipped: 0 };
  if (!hasDb()) {
    return { detailsUpserted: 0, photosInserted: 0, skipped: details.length };
  }
  const db = getDb();
  let detailsUpserted = 0;
  let photosInserted = 0;
  let skipped = 0;

  for (const d of details) {
    const listingId = await resolveListingId(d.source, d.sourceId);
    if (listingId === null) {
      skipped++;
      continue;
    }

    // Gone (404/410/403/redirect): mark the listing removed so it exits the
    // active enrichment / null-price pools, and DON'T overwrite an existing
    // enriched detail row with the empty tombstone fields (onConflictDoNothing
    // preserves a previously-scraped seller/VIN/equipment). A fresh gone row
    // still gets a tombstone detail so unenriched-mode notExists stops picking.
    if (d.gone) {
      try {
        await db.execute(sql`
          UPDATE listings SET removed_at = coalesce(removed_at, now()) WHERE id = ${listingId}
        `);
        await db
          .insert(listingDetails)
          .values({ listingId, description: '[GONE]', equipment: [] })
          .onConflictDoNothing({ target: listingDetails.listingId });
        detailsUpserted++;
      } catch (e) {
        if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'persistDetails.gone' });
        console.error('persistDetails_gone_failed', {
          source: d.source,
          sourceId: d.sourceId,
          error: e instanceof Error ? e.message : e,
        });
        skipped++;
      }
      continue;
    }

    try {
      await db
        .insert(listingDetails)
        .values({
          listingId,
          bodyType: d.bodyType,
          colorExterior: d.colorExterior,
          colorInterior: d.colorInterior,
          powerKw: d.powerKw,
          engineCcm: d.engineCcm,
          vin: d.vin,
          sellerType: d.sellerType,
          sellerName: d.sellerName,
          description: d.description,
          equipment: d.equipment,
        })
        .onConflictDoUpdate({
          target: listingDetails.listingId,
          set: {
            bodyType: sql`excluded.body_type`,
            colorExterior: sql`excluded.color_exterior`,
            colorInterior: sql`excluded.color_interior`,
            powerKw: sql`excluded.power_kw`,
            engineCcm: sql`excluded.engine_ccm`,
            vin: sql`excluded.vin`,
            sellerType: sql`excluded.seller_type`,
            sellerName: sql`excluded.seller_name`,
            description: sql`excluded.description`,
            equipment: sql`excluded.equipment`,
            detailedAt: sql`now()`,
          },
        });
      detailsUpserted++;

      if (d.photos.length > 0) {
        // Replace photos atomically: delete + insert in one transaction so a
        // mid-insert failure can't leave the listing photo-less.
        const photoRows = d.photos.slice(0, 100).map((url, i) => ({
          listingId,
          position: i + 1,
          url: url.slice(0, 2000),
        }));
        await db.transaction(async (tx) => {
          await tx.delete(listingPhotos).where(eq(listingPhotos.listingId, listingId));
          if (photoRows.length > 0) {
            await tx.insert(listingPhotos).values(photoRows);
          }
        });
        photosInserted += photoRows.length;
      }

      // Detail page typically has more accurate year/km/region/fuel than the
      // list card. Patch any NULL columns on listings — never overwrite a
      // non-null value because the list card might be the more trustworthy
      // source for that field (e.g. price is on every list card).
      const set: Record<string, unknown> = {};
      if (d.listingOverrides) {
        const o = d.listingOverrides;
        if (o.year != null) set.year = sql`coalesce(${listings.year}, ${o.year})`;
        if (o.mileageKm != null)
          set.mileageKm = sql`coalesce(${listings.mileageKm}, ${o.mileageKm})`;
        if (o.fuel != null) set.fuel = sql`coalesce(${listings.fuel}, ${o.fuel})`;
        if (o.transmission != null)
          set.transmission = sql`coalesce(${listings.transmission}, ${o.transmission})`;
        if (o.region != null) set.region = sql`coalesce(${listings.region}, ${o.region})`;
        if (o.priceEur != null)
          set.priceEur = sql`coalesce(${listings.priceEur}, ${String(o.priceEur)})`;
      }
      // Identity backfill for title-less/model-less stubs: resolve model_id the
      // same way list scraping does and patch model_id / raw_title only when
      // NULL. Same coalesce-fill-only guarantee as the field overrides.
      if (d.identity) {
        if (d.identity.rawTitle) {
          set.rawTitle = sql`coalesce(${listings.rawTitle}, ${d.identity.rawTitle})`;
        }
        const modelId = await ensureModelId(
          d.identity.makeSlug,
          d.identity.modelSlug,
          d.identity.rawTitle,
        );
        if (modelId != null) {
          set.modelId = sql`coalesce(${listings.modelId}, ${modelId})`;
        }
      }
      if (Object.keys(set).length > 0) {
        await db.update(listings).set(set).where(eq(listings.id, listingId));
      }
    } catch (e) {
      if (isConnectionError(e)) throw noteDbUnavailable(e, { step: 'persistDetails.row' });
      console.error('persistDetails_row_failed', {
        source: d.source,
        sourceId: d.sourceId,
        error: e instanceof Error ? e.message : e,
      });
      skipped++;
    }
  }
  return { detailsUpserted, photosInserted, skipped };
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((p) => (p.length > 0 ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(' ');
}

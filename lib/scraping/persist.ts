// Persistence layer for scraper output. Batched upserts into the `listings`
// table and a row in `scrape_runs` per source per run. All operations are
// graceful no-ops when DATABASE_URL is unset so dev / preview builds don't
// crash.

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { listings, scrapeRuns, vehicleMakes, vehicleModels } from '@/lib/db/schema';
import type { NormalizedListing, ScrapeResult, Source } from './types';

export type UpsertCounts = { added: number; updated: number; skipped: number };

const BATCH_SIZE = 50;

function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Process-local cache so each scrape run doesn't hammer the DB resolving the
// same make/model on every listing. Vercel cold starts reset it — fine, that
// just means the first listing per slug per cold start pays the round trip.
const makeIdCache = new Map<string, number>();
const modelIdCache = new Map<string, number>();

/** Test seam — clears the in-process lookup caches between tests. */
export function __resetModelCache(): void {
  makeIdCache.clear();
  modelIdCache.clear();
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
    console.error('ensureMakeId_failed', {
      makeSlug,
      error: e instanceof Error ? e.message : e,
    });
    return null;
  }
}

async function ensureModelId(
  makeSlug: string | null,
  modelSlug: string | null,
  displayName: string | null,
): Promise<number | null> {
  if (!modelSlug) return null;
  const cached = modelIdCache.get(modelSlug);
  if (cached) return cached;
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
    if (!makeId) return null;
    const id = 1_000_000 + (hash32(modelSlug) & 0x7fffff);
    await db
      .insert(vehicleModels)
      .values({
        id,
        makeId,
        slug: modelSlug,
        name: displayName ?? toTitleCase(modelSlug),
      })
      .onConflictDoNothing({ target: vehicleModels.slug });
    const refound = await db
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.slug, modelSlug))
      .limit(1);
    const finalId = refound[0]?.id ?? id;
    modelIdCache.set(modelSlug, finalId);
    return finalId;
  } catch (e) {
    console.error('ensureModelId_failed', {
      modelSlug,
      error: e instanceof Error ? e.message : e,
    });
    return null;
  }
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

  // Resolve all model IDs up front so the batch insert is one round trip per chunk.
  const resolved = await Promise.all(
    rows.map(async (r) => {
      if (!r.sourceId || !r.url) return null;
      const modelId = await ensureModelId(r.makeSlug, r.modelSlug, r.rawTitle);
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
        url: r.url,
        rawJson: r.rawPayload,
      };
    }),
  );
  const validRows = resolved.filter((r): r is NonNullable<typeof r> => r !== null);
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
            url: sql`excluded.url`,
            rawJson: sql`excluded.raw_json`,
            lastSeenAt: sql`now()`,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      for (const row of result) {
        if (row.inserted) added++;
        else updated++;
      }
    } catch (e) {
      console.error('listings_batch_upsert_failed', {
        chunkSize: chunk.length,
        firstSourceId: chunk[0]?.sourceId,
        error: e instanceof Error ? e.message : e,
      });
      skipped += chunk.length;
    }
  }
  return { added, updated, skipped };
}

export async function recordScrapeRun(
  source: Source,
  result: ScrapeResult,
  counts: UpsertCounts,
): Promise<void> {
  if (!hasDb()) return;
  try {
    const db = getDb();
    await db.insert(scrapeRuns).values({
      source,
      status: result.errors.length === 0 ? 'succeeded' : 'failed',
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      listingsAdded: counts.added,
      listingsUpdated: counts.updated,
      errorMessage: result.errors.length > 0 ? result.errors.slice(0, 5).join('; ') : null,
    });
  } catch (e) {
    console.error('scrape_run_record_failed', e instanceof Error ? e.message : e);
  }
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

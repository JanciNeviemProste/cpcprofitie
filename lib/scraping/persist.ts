// Persistence layer for scraper output. Upserts normalized listings into the
// `listings` table and records each run in `scrape_runs` for the admin panel.
// All operations no-op gracefully when DATABASE_URL is unset so dev / preview
// builds don't crash.

import { eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { listings, scrapeRuns, vehicleModels } from '@/lib/db/schema';
import type { NormalizedListing, ScrapeResult, Source } from './types';

export type UpsertCounts = { added: number; updated: number; skipped: number };

function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Resolve a slug to a model_id, lazily inserting an unknown model. */
async function ensureModelId(slug: string | null): Promise<number | null> {
  if (!slug) return null;
  try {
    const db = getDb();
    const rows = await db
      .select({ id: vehicleModels.id })
      .from(vehicleModels)
      .where(eq(vehicleModels.slug, slug))
      .limit(1);
    if (rows.length > 0) return rows[0]!.id;
    return null;
  } catch (e) {
    console.error('ensureModelId_failed', { slug, error: e instanceof Error ? e.message : e });
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
  for (const r of rows) {
    if (!r.sourceId || !r.url) {
      skipped++;
      continue;
    }
    const modelId = await ensureModelId(r.modelSlug);
    try {
      const result = await db
        .insert(listings)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [listings.source, listings.sourceId],
          set: {
            priceEur: r.priceEur != null ? String(r.priceEur) : null,
            year: r.year,
            mileageKm: r.mileageKm,
            fuel: r.fuel,
            transmission: r.transmission,
            region: r.region,
            modelId,
            lastSeenAt: sql`now()`,
            rawJson: r.rawPayload,
          },
        })
        .returning({ inserted: sql<boolean>`(xmax = 0)` });
      const inserted = result[0]?.inserted;
      if (inserted) added++;
      else updated++;
    } catch (e) {
      console.error('listing_upsert_failed', {
        source: r.source,
        sourceId: r.sourceId,
        error: e instanceof Error ? e.message : e,
      });
      skipped++;
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
    // Don't fail the scrape if telemetry recording is broken.
    console.error('scrape_run_record_failed', e instanceof Error ? e.message : e);
  }
}

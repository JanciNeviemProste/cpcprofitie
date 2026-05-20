// Shared overnight enrichment driver. Imported by per-source scripts
// (bazos-sk-enrich-all.ts, autobazar-sk-enrich-all.ts, autobazar-eu-enrich-all.ts).
//
// Pattern: query listings WHERE source=X AND no listing_details row exists,
// fetch detail page via runEnrichment (respects robots crawl-delay), then
// persistDetails writes back to DB (photos + listing_details + optional
// listing field patches via listingOverrides).
//
// Resumable: each batch picks fresh rows that haven't been enriched, so
// Ctrl+C and restart just continues. No state on disk needed.

import { and, eq, isNull, notExists, sql } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { listingDetails, listings } from '../lib/db/schema';
import { runEnrichment, persistDetails, type ScraperSource } from '../lib/scraping';
import type { NormalizedListing, Source } from '../lib/scraping';

const BATCH_SIZE = 50;
const DELAY_MS = 1200;

export type EnrichAllOptions = {
  /** Stop after this many listings (default: no cap). */
  maxListings?: number;
  /** If true, also re-enrich rows that already have details (verify mode). */
  reEnrich?: boolean;
};

export async function enrichAll(
  source: ScraperSource,
  opts: EnrichAllOptions = {},
): Promise<void> {
  const sourceId = source.id as Source;
  const startedAt = Date.now();
  let totalFetched = 0;
  let totalDetails = 0;
  let totalErrors = 0;
  let batchN = 0;
  let consecutiveEmpty = 0;

  console.log(`[${sourceId}] enrich-all starting (batch=${BATCH_SIZE}, delay=${DELAY_MS}ms)`);

  while (true) {
    if (opts.maxListings != null && totalFetched >= opts.maxListings) {
      console.log(`[${sourceId}] hit maxListings=${opts.maxListings}`);
      break;
    }

    const batch = await loadBatch(sourceId, BATCH_SIZE, opts.reEnrich === true);
    if (batch.length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) {
        console.log(`[${sourceId}] DONE — no more rows to enrich.`);
        break;
      }
      await sleep(2000);
      continue;
    }
    consecutiveEmpty = 0;
    batchN++;

    let result;
    try {
      result = await runEnrichment(source, batch, { limit: BATCH_SIZE, delayMs: DELAY_MS });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      console.error(`[${sourceId}] batch ${batchN} runEnrichment threw:`, err);
      totalErrors++;
      await sleep(5000);
      continue;
    }

    if (result.details.length > 0) {
      try {
        await persistDetails(result.details);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        console.error(`[${sourceId}] batch ${batchN} persistDetails threw:`, err);
        totalErrors++;
      }
    }

    totalFetched += result.fetched;
    totalDetails += result.details.length;
    totalErrors += result.errors.length;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0);
    const rate = totalFetched / Math.max(1, Number(elapsed));
    console.log(
      `[${sourceId}] batch ${batchN}: fetched ${result.fetched}/${batch.length}, details ${result.details.length}, errors ${result.errors.length}. ` +
        `Total: ${totalFetched} fetched, ${totalDetails} details, ${totalErrors} errors. ` +
        `Rate ${rate.toFixed(2)}/s, elapsed ${elapsed}s`,
    );
    if (result.errors.length > 0 && result.errors.length === batch.length) {
      console.error(`[${sourceId}] all errored in batch — pausing 30s`);
      await sleep(30000);
    }
  }

  const totalSecs = ((Date.now() - startedAt) / 1000).toFixed(0);
  console.log(
    `[${sourceId}] FINISHED in ${totalSecs}s — ${totalFetched} fetched, ${totalDetails} details, ${totalErrors} errors`,
  );
}

async function loadBatch(
  source: Source,
  size: number,
  includeAlreadyEnriched: boolean,
): Promise<NormalizedListing[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: listings.id,
      source: listings.source,
      sourceId: listings.sourceId,
      url: listings.url,
      priceEur: listings.priceEur,
      year: listings.year,
      mileageKm: listings.mileageKm,
      fuel: listings.fuel,
      transmission: listings.transmission,
      region: listings.region,
      modelId: listings.modelId,
    })
    .from(listings)
    .where(
      includeAlreadyEnriched
        ? and(eq(listings.source, source), isNull(listings.removedAt))
        : and(
            eq(listings.source, source),
            isNull(listings.removedAt),
            notExists(
              db
                .select({ x: sql`1` })
                .from(listingDetails)
                .where(eq(listingDetails.listingId, listings.id)),
            ),
          ),
    )
    .orderBy(listings.id)
    .limit(size);

  return rows.map((r) => ({
    source: r.source as Source,
    sourceId: r.sourceId,
    url: r.url,
    makeSlug: null,
    modelSlug: null,
    priceEur: r.priceEur != null ? Number(r.priceEur) : null,
    year: r.year,
    mileageKm: r.mileageKm,
    fuel: r.fuel,
    transmission: r.transmission,
    region: r.region,
    rawTitle: null,
    rawPayload: {},
  }));
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

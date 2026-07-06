// Shared helper that selects listings to enrich for one source, in batches.
// Used by both the local enrich-all scripts and the server-side
// /api/cron/enrich-source endpoint.
//
// mode:
//   'unenriched' (default) — listings with no listing_details row yet.
//   'null-price'           — active listings still missing a price, regardless
//                            of enrichment status. Backfills price from the
//                            detail page for old rows scraped before the
//                            listing-page parser extracted price.

import { and, eq, gt, isNull, notExists, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { listingDetails, listings } from '../db/schema';
import type { NormalizedListing, Source } from './types';

export type PartitionOpts = { index: number; modulo: number };
export type EnrichSelectMode = 'unenriched' | 'null-price';

export async function loadUnenrichedBatch(
  source: Source,
  size: number,
  partition?: PartitionOpts,
  mode: EnrichSelectMode = 'unenriched',
  // Cursor for 'null-price' mode: rows whose detail yields no price stay
  // null-price and would be re-selected forever without this. The caller
  // advances it past each batch (read from rawPayload.__cursorId). Ignored in
  // 'unenriched' mode, which self-advances as rows gain a listing_details row.
  afterId?: bigint,
): Promise<NormalizedListing[]> {
  const db = getDb();
  // id-based partitioning lets N parallel loops work on disjoint subsets of
  // listings without `FOR UPDATE SKIP LOCKED`. Each shell gets (index, modulo)
  // and we filter `id % modulo = index`.
  const partitionFilter =
    partition && partition.modulo > 1
      ? sql`(${listings.id} % ${partition.modulo}) = ${partition.index}`
      : undefined;
  const selectFilter =
    mode === 'null-price'
      ? and(
          isNull(listings.priceEur),
          isNull(listings.canonicalListingId),
          isNull(listings.soldAt),
          isNull(listings.removedAt),
          afterId != null ? gt(listings.id, afterId) : undefined,
        )
      : notExists(
          db
            .select({ x: sql`1` })
            .from(listingDetails)
            .where(eq(listingDetails.listingId, listings.id)),
        );
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
    })
    .from(listings)
    .where(and(eq(listings.source, source), selectFilter, partitionFilter))
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
    // Expose the row id so the null-price backfill can advance its cursor.
    rawPayload: { __cursorId: r.id.toString() },
  }));
}

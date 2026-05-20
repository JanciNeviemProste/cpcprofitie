// Shared helper that selects un-enriched listings for one source, in batches.
// Used by both the local enrich-all scripts and the server-side
// /api/cron/enrich-source endpoint.

import { and, eq, notExists, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { listingDetails, listings } from '../db/schema';
import type { NormalizedListing, Source } from './types';

export async function loadUnenrichedBatch(
  source: Source,
  size: number,
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
    })
    .from(listings)
    .where(
      and(
        eq(listings.source, source),
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

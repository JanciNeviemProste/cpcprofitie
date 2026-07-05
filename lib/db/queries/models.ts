// Model options for the garage/watchlist pickers. Only models that have at
// least one active canonical listing — an empty-market model in the picker
// would create watchlists that can never match anything.

import * as Sentry from '@sentry/nextjs';
import { asc, eq, exists, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from '../index';
import { listings, vehicleMakes, vehicleModels } from '../schema';

export type ModelOption = {
  id: number;
  name: string;
  makeName: string;
};

// Cached: the semi-join over ~90k listings is identical for every user and
// only drifts with scrape cadence, but the pages calling this are
// force-dynamic — without the cache it re-executes per page view. Same
// pattern as getRegionGroups in listings.ts (incl. caching the graceful
// fallback on transient errors).
export const getModelOptions = unstable_cache(getModelOptionsUncached, ['model-options'], {
  revalidate: 3600,
});

// Graceful-empty on DB unavailability, matching the other query modules.
async function getModelOptionsUncached(): Promise<ModelOption[]> {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: vehicleModels.id,
        name: vehicleModels.name,
        makeName: vehicleMakes.name,
      })
      .from(vehicleModels)
      .innerJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
      .where(
        exists(
          db
            .select({ one: sql`1` })
            .from(listings)
            .where(
              sql`${listings.modelId} = ${vehicleModels.id}
                AND ${listings.canonicalListingId} IS NULL
                AND ${listings.removedAt} IS NULL
                AND ${listings.soldAt} IS NULL`,
            ),
        ),
      )
      .orderBy(asc(vehicleMakes.name), asc(vehicleModels.name));
    return rows;
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'models', step: 'getModelOptions' } });
    return [];
  }
}

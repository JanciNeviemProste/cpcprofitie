// Read-side helpers for the dashboard pages. Replaces lib/mock for /app/*
// surfaces. Each function returns a graceful empty result when the DB is
// unavailable (preview deploys without DATABASE_URL).

import * as Sentry from '@sentry/nextjs';
import { and, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { plausibleListing } from '@/lib/analytics/quality';
import {
  garage,
  listings,
  vehicleMakes,
  vehicleModels,
  watchlist,
} from '@/lib/db/schema';

export type TrendingItem = {
  modelSlug: string;
  modelName: string;
  countActive: number;
  median: number | null;
};

/** Top N models by active listing count. Falls back gracefully when listings
 *  table lacks model_id (e.g. pre-backfill). Listings without model_id are
 *  bucketed into an "unknown" sentinel and excluded. */
export async function getTrendingModels(limit = 20): Promise<TrendingItem[]> {
  try {
    return await getTrendingModelsUnsafe(limit);
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'dashboard', step: 'getTrendingModels' } });
    return [];
  }
}

async function getTrendingModelsUnsafe(limit: number): Promise<TrendingItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      modelId: listings.modelId,
      slug: vehicleModels.slug,
      name: vehicleModels.name,
      makeName: vehicleMakes.name,
      count: sql<number>`count(*)::int`,
      median: sql<number | null>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${listings.priceEur})::float8`,
    })
    .from(listings)
    .innerJoin(vehicleModels, eq(vehicleModels.id, listings.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(
      and(
        sql`${listings.canonicalListingId} IS NULL`,
        sql`${listings.removedAt} IS NULL`,
        sql`${listings.soldAt} IS NULL`,
        // Keep implausible prices/mileage out of the median.
        plausibleListing({
          priceEur: listings.priceEur,
          mileageKm: listings.mileageKm,
          year: listings.year,
        }),
      ),
    )
    .groupBy(listings.modelId, vehicleModels.slug, vehicleModels.name, vehicleMakes.name)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows.map((r) => ({
    modelSlug: r.slug ?? `model-${r.modelId}`,
    modelName: [r.makeName, r.name].filter(Boolean).join(' ') || (r.slug ?? 'Unknown'),
    countActive: Number(r.count) || 0,
    median: r.median != null ? Math.round(Number(r.median)) : null,
  }));
}

export type GarageRow = {
  id: string;
  modelSlug: string | null;
  modelName: string;
  year: number | null;
  mileageKm: number | null;
  purchasePriceEur: number | null;
  targetMarginEur: number | null;
};

export async function getGarageEntries(userId: string): Promise<GarageRow[]> {
  try {
    return await getGarageEntriesUnsafe(userId);
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'dashboard', step: 'getGarageEntries' } });
    return [];
  }
}

async function getGarageEntriesUnsafe(userId: string): Promise<GarageRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: garage.id,
      label: garage.label,
      year: garage.year,
      mileageKm: garage.mileageKm,
      purchasePriceEur: garage.purchasePriceEur,
      targetMarginEur: garage.targetMarginEur,
      modelSlug: vehicleModels.slug,
      modelName: vehicleModels.name,
      makeName: vehicleMakes.name,
    })
    .from(garage)
    .leftJoin(vehicleModels, eq(vehicleModels.id, garage.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(eq(garage.userId, userId))
    .orderBy(desc(garage.createdAt));

  return rows.map((r) => ({
    id: r.id,
    modelSlug: r.modelSlug ?? null,
    modelName:
      r.label ?? [r.makeName, r.modelName].filter(Boolean).join(' ') ?? 'Vozidlo',
    year: r.year,
    mileageKm: r.mileageKm,
    purchasePriceEur: r.purchasePriceEur != null ? Number(r.purchasePriceEur) : null,
    targetMarginEur: r.targetMarginEur != null ? Number(r.targetMarginEur) : null,
  }));
}

export type ModelKpi = {
  slug: string;
  modelName: string;
  countActive: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  avgYear: number | null;
  avgMileageKm: number | null;
};

export async function getModelKpi(slug: string): Promise<ModelKpi | null> {
  try {
    return await getModelKpiUnsafe(slug);
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'dashboard', step: 'getModelKpi' } });
    return null;
  }
}

async function getModelKpiUnsafe(slug: string): Promise<ModelKpi | null> {
  const db = getDb();
  const rows = await db
    .select({
      slug: vehicleModels.slug,
      name: vehicleModels.name,
      makeName: vehicleMakes.name,
      count: sql<number>`count(*)::int`,
      median: sql<number | null>`percentile_cont(0.5) WITHIN GROUP (ORDER BY ${listings.priceEur})::float8`,
      p25: sql<number | null>`percentile_cont(0.25) WITHIN GROUP (ORDER BY ${listings.priceEur})::float8`,
      p75: sql<number | null>`percentile_cont(0.75) WITHIN GROUP (ORDER BY ${listings.priceEur})::float8`,
      avgYear: sql<number | null>`avg(${listings.year})::float8`,
      avgMileage: sql<number | null>`avg(${listings.mileageKm})::float8`,
    })
    .from(listings)
    .innerJoin(vehicleModels, eq(vehicleModels.id, listings.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(
      and(
        eq(vehicleModels.slug, slug),
        sql`${listings.canonicalListingId} IS NULL`,
        sql`${listings.removedAt} IS NULL`,
        sql`${listings.soldAt} IS NULL`,
        plausibleListing({
          priceEur: listings.priceEur,
          mileageKm: listings.mileageKm,
          year: listings.year,
        }),
      ),
    )
    .groupBy(vehicleModels.slug, vehicleModels.name, vehicleMakes.name)
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return {
    slug: r.slug,
    modelName: [r.makeName, r.name].filter(Boolean).join(' '),
    countActive: Number(r.count) || 0,
    median: r.median != null ? Math.round(Number(r.median)) : null,
    p25: r.p25 != null ? Math.round(Number(r.p25)) : null,
    p75: r.p75 != null ? Math.round(Number(r.p75)) : null,
    avgYear: r.avgYear != null ? Math.round(Number(r.avgYear)) : null,
    avgMileageKm: r.avgMileage != null ? Math.round(Number(r.avgMileage)) : null,
  };
}

export type WatchlistRow = {
  id: string;
  modelSlug: string | null;
  modelName: string;
  region: string | null;
  maxPriceEur: number | null;
  minYear: number | null;
  notifyByEmail: boolean;
};

export async function getWatchlistEntries(userId: string): Promise<WatchlistRow[]> {
  try {
    return await getWatchlistEntriesUnsafe(userId);
  } catch (e) {
    Sentry.captureException(e, { tags: { component: 'dashboard', step: 'getWatchlistEntries' } });
    return [];
  }
}

async function getWatchlistEntriesUnsafe(userId: string): Promise<WatchlistRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: watchlist.id,
      region: watchlist.region,
      maxPriceEur: watchlist.maxPriceEur,
      minYear: watchlist.minYear,
      notifyByEmail: watchlist.notifyByEmail,
      modelSlug: vehicleModels.slug,
      modelName: vehicleModels.name,
      makeName: vehicleMakes.name,
    })
    .from(watchlist)
    .leftJoin(vehicleModels, eq(vehicleModels.id, watchlist.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(eq(watchlist.userId, userId))
    .orderBy(desc(watchlist.createdAt));

  return rows.map((r) => ({
    id: r.id,
    modelSlug: r.modelSlug ?? null,
    modelName: [r.makeName, r.modelName].filter(Boolean).join(' ') || 'Model',
    region: r.region,
    maxPriceEur: r.maxPriceEur != null ? Number(r.maxPriceEur) : null,
    minYear: r.minYear,
    notifyByEmail: r.notifyByEmail,
  }));
}

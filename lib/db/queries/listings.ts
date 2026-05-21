// Read-side query helpers for the listings table. Used by the `/app/listings`
// UI to paginate over scraped inventory. No write paths live here — those
// stay in `lib/scraping/persist.ts`.

import { and, asc, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm';
import { getDb } from '../index';
import {
  listingDetails,
  listingPhotos,
  listings,
  vehicleMakes,
  vehicleModels,
} from '../schema';
import type { RawFuel, Source } from '@/lib/scraping/types';

export type ListingsSort = 'newest' | 'oldest' | 'price-asc' | 'price-desc';

export type ListingFilters = {
  source?: Source;
  /** Substring match against make name. autobazar.eu sitemap listings have
   *  no title, so search hits the joined make/model name instead. */
  q?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  fuel?: RawFuel;
};

export type ListingRow = {
  id: bigint;
  source: Source;
  sourceId: string;
  url: string;
  makeName: string | null;
  modelName: string | null;
  rawTitle: string | null;
  priceEur: number | null;
  year: number | null;
  mileageKm: number | null;
  fuel: RawFuel | null;
  region: string | null;
  firstSeenAt: Date;
  heroPhotoUrl: string | null;
  viewCount: number | null;
  isFeatured: boolean;
};

export type ListingDetailFull = ListingRow & {
  description: string | null;
  vin: string | null;
  bodyType: string | null;
  colorExterior: string | null;
  powerKw: number | null;
  engineCcm: number | null;
  sellerType: 'private' | 'dealer' | null;
  sellerName: string | null;
  equipment: string[];
  photos: string[];
};

type GetListingsOpts = {
  page: number;
  perPage: number;
  filters?: ListingFilters;
  sort?: ListingsSort;
};

function buildWhere(filters: ListingFilters | undefined) {
  if (!filters) return undefined;
  const parts = [];
  if (filters.source) parts.push(eq(listings.source, filters.source));
  if (filters.minPrice != null)
    parts.push(gte(listings.priceEur, String(filters.minPrice)));
  if (filters.maxPrice != null)
    parts.push(lte(listings.priceEur, String(filters.maxPrice)));
  if (filters.minYear != null) parts.push(gte(listings.year, filters.minYear));
  if (filters.fuel) parts.push(eq(listings.fuel, filters.fuel));
  if (filters.q && filters.q.trim()) {
    const needle = `%${filters.q.trim()}%`;
    parts.push(
      sql`(${vehicleMakes.name} ILIKE ${needle} OR ${vehicleModels.name} ILIKE ${needle})`,
    );
  }
  if (parts.length === 0) return undefined;
  return and(...parts);
}

function orderBy(sort: ListingsSort) {
  switch (sort) {
    case 'oldest':
      return [asc(listings.firstSeenAt), asc(listings.id)];
    case 'price-asc':
      return [asc(listings.priceEur), desc(listings.id)];
    case 'price-desc':
      return [desc(listings.priceEur), desc(listings.id)];
    case 'newest':
    default:
      return [desc(listings.firstSeenAt), desc(listings.id)];
  }
}

export async function getListings(
  opts: GetListingsOpts,
): Promise<{ rows: ListingRow[]; total: number }> {
  const db = getDb();
  const page = Math.max(1, opts.page);
  const perPage = Math.min(200, Math.max(1, opts.perPage));
  const offset = (page - 1) * perPage;
  const filters = opts.filters;
  const sort = opts.sort ?? 'newest';
  const where = buildWhere(filters);

  // Hero photo subquery: pull position=1 for each listing in one LEFT JOIN.
  const heroPhoto = db
    .$with('hero_photo')
    .as(
      db
        .select({
          listingId: listingPhotos.listingId,
          url: listingPhotos.url,
        })
        .from(listingPhotos)
        .where(eq(listingPhotos.position, 1)),
    );

  const rowsP = db
    .with(heroPhoto)
    .select({
      id: listings.id,
      source: listings.source,
      sourceId: listings.sourceId,
      url: listings.url,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      rawTitle: listings.rawTitle,
      priceEur: listings.priceEur,
      year: listings.year,
      mileageKm: listings.mileageKm,
      fuel: listings.fuel,
      region: listings.region,
      firstSeenAt: listings.firstSeenAt,
      heroPhotoUrl: heroPhoto.url,
      viewCount: listings.viewCount,
      isFeatured: listings.isFeatured,
    })
    .from(listings)
    .leftJoin(vehicleModels, eq(vehicleModels.id, listings.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .leftJoin(heroPhoto, eq(heroPhoto.listingId, listings.id))
    .where(where)
    .orderBy(...orderBy(sort))
    .limit(perPage)
    .offset(offset);

  const totalP = db
    .select({ n: sql<number>`count(*)::int` })
    .from(listings)
    .leftJoin(vehicleModels, eq(vehicleModels.id, listings.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .where(where);

  const [rows, totalRows] = await Promise.all([rowsP, totalP]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      source: r.source as Source,
      sourceId: r.sourceId,
      url: r.url,
      makeName: r.makeName ?? null,
      modelName: r.modelName ?? null,
      rawTitle: r.rawTitle ?? null,
      priceEur: r.priceEur != null ? Number(r.priceEur) : null,
      year: r.year,
      mileageKm: r.mileageKm,
      fuel: (r.fuel ?? null) as RawFuel | null,
      region: r.region,
      firstSeenAt: r.firstSeenAt,
      heroPhotoUrl: r.heroPhotoUrl,
      viewCount: r.viewCount ?? null,
      isFeatured: r.isFeatured ?? false,
    })),
    total: totalRows[0]?.n ?? 0,
  };
}

export async function getListingById(
  id: bigint,
): Promise<ListingDetailFull | null> {
  const db = getDb();
  const [base] = await db
    .select({
      id: listings.id,
      source: listings.source,
      sourceId: listings.sourceId,
      url: listings.url,
      makeName: vehicleMakes.name,
      modelName: vehicleModels.name,
      rawTitle: listings.rawTitle,
      priceEur: listings.priceEur,
      year: listings.year,
      mileageKm: listings.mileageKm,
      fuel: listings.fuel,
      region: listings.region,
      firstSeenAt: listings.firstSeenAt,
      viewCount: listings.viewCount,
      isFeatured: listings.isFeatured,
      description: listingDetails.description,
      vin: listingDetails.vin,
      bodyType: listingDetails.bodyType,
      colorExterior: listingDetails.colorExterior,
      powerKw: listingDetails.powerKw,
      engineCcm: listingDetails.engineCcm,
      sellerType: listingDetails.sellerType,
      sellerName: listingDetails.sellerName,
      equipment: listingDetails.equipment,
    })
    .from(listings)
    .leftJoin(vehicleModels, eq(vehicleModels.id, listings.modelId))
    .leftJoin(vehicleMakes, eq(vehicleMakes.id, vehicleModels.makeId))
    .leftJoin(listingDetails, eq(listingDetails.listingId, listings.id))
    .where(eq(listings.id, id))
    .limit(1);

  if (!base) return null;

  const photoRows = await db
    .select({ url: listingPhotos.url, position: listingPhotos.position })
    .from(listingPhotos)
    .where(eq(listingPhotos.listingId, id))
    .orderBy(asc(listingPhotos.position));

  const photos = photoRows.map((p) => p.url);

  return {
    id: base.id,
    source: base.source as Source,
    sourceId: base.sourceId,
    url: base.url,
    makeName: base.makeName ?? null,
    modelName: base.modelName ?? null,
    rawTitle: base.rawTitle ?? null,
    priceEur: base.priceEur != null ? Number(base.priceEur) : null,
    year: base.year,
    mileageKm: base.mileageKm,
    fuel: (base.fuel ?? null) as RawFuel | null,
    region: base.region,
    firstSeenAt: base.firstSeenAt,
    heroPhotoUrl: photos[0] ?? null,
    description: base.description,
    vin: base.vin,
    bodyType: base.bodyType,
    colorExterior: base.colorExterior,
    powerKw: base.powerKw,
    engineCcm: base.engineCcm,
    sellerType: base.sellerType,
    sellerName: base.sellerName,
    equipment: Array.isArray(base.equipment) ? (base.equipment as string[]) : [],
    photos,
  };
}

export type SourceCount = { source: Source; count: number };

export async function getSourceCounts(): Promise<SourceCount[]> {
  const db = getDb();
  const rows = await db
    .select({
      source: listings.source,
      n: sql<number>`count(*)::int`,
    })
    .from(listings)
    .groupBy(listings.source)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({ source: r.source as Source, count: r.n }));
}

export type ListingsStats = {
  totalListings: number;
  totalPhotos: number;
  totalEnriched: number;
  bySource: SourceCount[];
};

export async function getListingsStats(): Promise<ListingsStats> {
  const db = getDb();
  const [listingsCount, photosCount, enrichedCount, bySource] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(listings),
    db.select({ n: sql<number>`count(*)::int` }).from(listingPhotos),
    db.select({ n: sql<number>`count(*)::int` }).from(listingDetails),
    getSourceCounts(),
  ]);
  return {
    totalListings: listingsCount[0]?.n ?? 0,
    totalPhotos: photosCount[0]?.n ?? 0,
    totalEnriched: enrichedCount[0]?.n ?? 0,
    bySource,
  };
}

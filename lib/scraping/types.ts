// Shared types for the scraping pipeline. The pipeline emits NormalizedListing
// rows that downstream upsert + aggregation steps consume regardless of source.

export type Source = 'autobazar.sk' | 'autobazar.eu' | 'bazos.sk' | 'sauto.cz';

// sauto.cz is intentionally excluded from cron runs: its robots.txt has
// `User-agent: *  Disallow: /` and only whitelists Googlebot/SeznamBot/etc.
// We respect that. The source plugin still exists in the registry for
// historical fixtures + future use if we get explicit written permission.
export const ALL_SOURCES: readonly Source[] = [
  'autobazar.sk',
  'autobazar.eu',
  'bazos.sk',
] as const;

export type RawFuel =
  | 'gasoline'
  | 'diesel'
  | 'hybrid'
  | 'phev'
  | 'electric'
  | 'lpg'
  | 'cng'
  | 'other';

export type RawTransmission = 'manual' | 'automatic' | 'other';

export type NormalizedListing = {
  source: Source;
  sourceId: string;
  url: string;
  makeSlug: string | null;
  modelSlug: string | null;
  priceEur: number | null;
  /** Original price in source currency if non-EUR (CZK). Stored for audit. */
  priceCzk?: number | null;
  year: number | null;
  mileageKm: number | null;
  fuel: RawFuel | null;
  transmission: RawTransmission | null;
  region: string | null;
  rawTitle: string | null;
  rawPayload: Record<string, unknown>;
};

export type ScrapeResult = {
  source: Source;
  startedAt: Date;
  finishedAt: Date;
  listings: NormalizedListing[];
  pagesVisited: number;
  errors: string[];
};

export type SellerType = 'private' | 'dealer';

/** Output of a per-listing detail-page enrichment fetch. Most fields are
 *  optional because not every source publishes them and old listings get
 *  truncated. */
export type NormalizedDetail = {
  source: Source;
  sourceId: string;
  /** Full-resolution photo URLs in display order. May be empty. */
  photos: string[];
  description: string | null;
  vin: string | null;
  bodyType: string | null;
  colorExterior: string | null;
  colorInterior: string | null;
  powerKw: number | null;
  engineCcm: number | null;
  sellerType: SellerType | null;
  sellerName: string | null;
  /** Flat list of equipment labels (klimatizácia, ABS, ESP, ...). */
  equipment: string[];
};

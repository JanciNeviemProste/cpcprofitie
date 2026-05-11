// Shared types for the scraping pipeline. The pipeline emits NormalizedListing
// rows that downstream upsert + aggregation steps consume regardless of source.

export type Source = 'autobazar.sk' | 'autobazar.eu' | 'bazos.sk' | 'sauto.cz';

export const ALL_SOURCES: readonly Source[] = [
  'autobazar.sk',
  'autobazar.eu',
  'bazos.sk',
  'sauto.cz',
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

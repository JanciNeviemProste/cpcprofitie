import type { NormalizedDetail, NormalizedListing, Source } from '../types';

// Shared UA string. Every CPCProfit scraper identifies itself the same way so
// site operators can attribute traffic + block / allow uniformly.
export const USER_AGENT =
  'CPCProfit-Bot/0.1 (+https://cpcprofit.sk/bot) — respects robots.txt; contact: hello@cpcprofit.sk';

/** A single source plugin. Generic runScrape() in `../scrape.ts` drives the
 *  listing-page side; runEnrichment() optionally fetches detail pages when
 *  the source exposes `detailUrl` + `parseDetailPage`. */
export interface ScraperSource {
  readonly id: Source;
  readonly baseUrl: string;
  /** Build the URL for a 1-based page index. */
  pageUrl(opts: { page: number }): string;
  /** Parse a fetched listing page into normalized rows. */
  parseListingsPage(html: string): NormalizedListing[];
  /** OPTIONAL: build the detail-page URL for a listing. Required for
   *  enrichment; omit on sources whose listings are already complete. */
  detailUrl?(listing: NormalizedListing): string;
  /** OPTIONAL: parse a fetched detail page into a NormalizedDetail. */
  parseDetailPage?(html: string, listing: NormalizedListing): NormalizedDetail;
}

export class ScrapeForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeForbiddenError';
  }
}

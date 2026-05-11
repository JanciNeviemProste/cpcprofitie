import type { NormalizedListing, Source } from '../types';

// Shared UA string. Every CPCProfit scraper identifies itself the same way so
// site operators can attribute traffic + block / allow uniformly.
export const USER_AGENT =
  'CPCProfit-Bot/0.1 (+https://cpcprofit.sk/bot) — respects robots.txt; contact: hello@cpcprofit.sk';

/** A single source plugin. Generic runScrape() in `../scrape.ts` drives it. */
export interface ScraperSource {
  readonly id: Source;
  readonly baseUrl: string;
  /** Build the URL for a 1-based page index. */
  pageUrl(opts: { page: number }): string;
  /** Parse a fetched listing page into normalized rows. */
  parseListingsPage(html: string): NormalizedListing[];
}

export class ScrapeForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeForbiddenError';
  }
}

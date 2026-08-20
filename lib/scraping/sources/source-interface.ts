import type { CheerioAPI } from 'cheerio';
import type { NormalizedDetail, NormalizedListing, Source } from '../types';

// cheerio doesn't re-export domhandler's AnyNode and pnpm doesn't hoist the
// transitive dep, so extract the node type structurally from the public API.
export type CheerioNode = Extract<
  NonNullable<Parameters<CheerioAPI['html']>[0]>,
  { type: unknown }
>;

// Shared UA string. Every CPCProfit scraper identifies itself the same way so
// site operators can attribute traffic + block / allow uniformly. The info URL
// points at the live deployment; swap to the branded domain once registered.
export const USER_AGENT =
  'CPCProfit-Bot/0.1 (+https://cpcprofitie.vercel.app/bot) - respects robots.txt; contact: hello@cpcprofit.sk';

/** A single source plugin. Generic runScrape() in `../scrape.ts` drives the
 *  listing-page side; runEnrichment() optionally fetches detail pages when
 *  the source exposes `detailUrl` + `parseDetailPage`. */
export interface ScraperSource {
  readonly id: Source;
  readonly baseUrl: string;
  /** Build the URL for a 1-based page index. */
  pageUrl(opts: { page: number }): string;
  /**
   * Size of this source's page space, when it is bounded and known.
   *
   * Sources whose pageUrl indexes a fixed list take the page number modulo that
   * list, so asking for page 900 of an 847-entry space quietly returns page 53
   * — the rotation would report progress while re-reading rows it had just
   * read. Undefined means "unbounded as far as we know": depth is then learned
   * from where the source starts returning nothing.
   */
  maxPage?: number;
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

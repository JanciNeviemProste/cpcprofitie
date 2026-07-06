// Second-pass enrichment driver. Takes the listing-page output and, for each
// row, fetches the listing's detail URL and runs the source's
// `parseDetailPage`. Sources without a `parseDetailPage` are skipped.

import * as Sentry from '@sentry/nextjs';
import { isAllowed, parseRobotsTxt, crawlDelayFor } from './robots';
import { ScrapeForbiddenError, USER_AGENT, type ScraperSource } from './sources/source-interface';
import type { NormalizedDetail, NormalizedListing } from './types';

export type EnrichOptions = {
  /** Hard cap on how many detail pages to fetch per run. */
  limit?: number;
  /** Backoff between requests in ms. Robots Crawl-delay wins if larger. */
  delayMs?: number;
  fetchImpl?: typeof fetch;
};

export type EnrichResult = {
  details: NormalizedDetail[];
  fetched: number;
  errors: string[];
};

// Re-uses the per-host robots cache by re-deriving from the URL. To keep this
// module decoupled from scrape.ts the cache lives there; here we just call
// `isAllowed` against the parsed robots body fetched on demand.
const robotsBodyCacheByHost = new Map<string, { fetchedAt: number; body: string }>();
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

async function fetchRobots(baseUrl: string, f: typeof fetch): Promise<string> {
  const host = new URL(baseUrl).host;
  const now = Date.now();
  const cached = robotsBodyCacheByHost.get(host);
  if (cached && now - cached.fetchedAt < ROBOTS_TTL_MS) return cached.body;
  try {
    const res = await f(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
    });
    const body = res.ok ? await res.text() : '';
    robotsBodyCacheByHost.set(host, { fetchedAt: now, body });
    return body;
  } catch (e) {
    // Permissive cache so a DNS hiccup doesn't disable crawling, but alert
    // so we know robots.txt is effectively missing for this host.
    Sentry.captureException(e, {
      tags: { component: 'enrich', step: 'fetchRobots' },
      extra: { host },
    });
    robotsBodyCacheByHost.set(host, { fetchedAt: now, body: '' });
    return '';
  }
}

export function __resetEnrichRobotsCache(): void {
  robotsBodyCacheByHost.clear();
}

export async function runEnrichment(
  source: ScraperSource,
  listings: NormalizedListing[],
  opts: EnrichOptions = {},
): Promise<EnrichResult> {
  if (!source.detailUrl || !source.parseDetailPage) {
    return { details: [], fetched: 0, errors: ['source has no detailUrl/parseDetailPage'] };
  }
  const limit = opts.limit ?? 30;
  const f = opts.fetchImpl ?? fetch;
  const candidates = listings.slice(0, limit);
  const details: NormalizedDetail[] = [];
  const errors: string[] = [];

  const robotsBody = await fetchRobots(source.baseUrl, f);
  const robots = parseRobotsTxt(robotsBody);
  const baselineDelay = crawlDelayFor(robots, USER_AGENT);
  const delay = baselineDelay ? Math.max(opts.delayMs ?? 0, baselineDelay * 1000) : (opts.delayMs ?? 1500);

  let fetched = 0;
  for (const listing of candidates) {
    const url = source.detailUrl!(listing);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`bad detail URL for ${listing.sourceId}: ${url}`);
      continue;
    }
    const pathWithQuery = parsed.pathname + parsed.search;
    if (!isAllowed(robots, USER_AGENT, pathWithQuery)) {
      throw new ScrapeForbiddenError(
        `${source.id} robots.txt disallows detail ${pathWithQuery} for ${USER_AGENT}`,
      );
    }
    try {
      const res = await f(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      fetched++;
      // Deleted listings often 200-redirect to a search/home page (e.g.
      // bazos.sk /inzerat/<id>/ → /inzeraty/<slug>/, autobazar.sk → a listing
      // grid). Parsing that landing page would scrape ANOTHER car's price into
      // this listing. Detect generically: a redirect whose final URL no longer
      // contains this listing's sourceId is gone. (Canonicalizing redirects —
      // trailing slash, www — keep the id, so they're not flagged.)
      const finalUrl = res.url || url;
      const goneViaRedirect =
        res.ok && Boolean(res.url) && res.url !== url && !finalUrl.includes(listing.sourceId);
      if (!res.ok || goneViaRedirect) {
        const status = goneViaRedirect ? 'redirect→gone' : `HTTP ${res.status}`;
        errors.push(`${listing.sourceId}: ${status}`);
        // Tombstone permanently-gone listings so they exit the enrichment /
        // null-price pools. 404/410 = removed/sold; 403 = source blocks us.
        // `gone: true` tells persistDetails to mark removed_at and NOT wipe an
        // existing enriched detail row with these empty fields.
        if (
          goneViaRedirect ||
          res.status === 404 ||
          res.status === 410 ||
          res.status === 403
        ) {
          details.push({
            source: source.id,
            sourceId: listing.sourceId,
            gone: true,
            photos: [],
            description: '[GONE]',
            vin: null,
            bodyType: null,
            colorExterior: null,
            colorInterior: null,
            powerKw: null,
            engineCcm: null,
            sellerType: null,
            sellerName: null,
            equipment: [],
          });
        }
        continue;
      }
      const html = await res.text();
      details.push(source.parseDetailPage!(html, listing));
    } catch (e) {
      errors.push(`${listing.sourceId}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
    if (fetched < candidates.length) await sleep(delay);
  }

  return { details, fetched, errors };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

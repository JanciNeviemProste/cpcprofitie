// Generic scrape driver. Per-source plugins (lib/scraping/sources/*.ts) supply
// page URLs and parsing; this module owns robots.txt fetch+cache, per-page
// allow-checks, the fetch loop, crawl-delay, and error aggregation. Add a new
// source by implementing ScraperSource and registering it in registry.ts.

import { crawlDelayFor, isAllowed, parseRobotsTxt } from './robots';
import { ScrapeForbiddenError, USER_AGENT, type ScraperSource } from './sources/source-interface';
import type { NormalizedListing, ScrapeResult, Source } from './types';

export type RunScrapeOptions = {
  pages?: number;
  fetchImpl?: typeof fetch;
  /** Minimum backoff between pages in ms. Robots-supplied Crawl-delay wins if larger. */
  delayMs?: number;
};

type RobotsCacheEntry = {
  fetchedAt: number;
  perPath: (path: string) => boolean;
  crawlDelaySec?: number;
};

const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

// One robots cache per source — both bazos.sk and sauto.cz live on different
// origins so their robots.txt is fetched independently.
const robotsCacheByHost = new Map<string, RobotsCacheEntry>();
const robotsInflightByHost = new Map<string, Promise<RobotsCacheEntry>>();

async function ensureRobots(baseUrl: string, f: typeof fetch): Promise<RobotsCacheEntry> {
  const host = new URL(baseUrl).host;
  const now = Date.now();
  const cached = robotsCacheByHost.get(host);
  if (cached && now - cached.fetchedAt < ROBOTS_TTL_MS) return cached;
  const inflight = robotsInflightByHost.get(host);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const res = await f(`${baseUrl}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
      });
      if (!res.ok) {
        const entry: RobotsCacheEntry = { fetchedAt: now, perPath: () => true };
        robotsCacheByHost.set(host, entry);
        return entry;
      }
      const body = await res.text();
      const robots = parseRobotsTxt(body);
      const entry: RobotsCacheEntry = {
        fetchedAt: now,
        perPath: (path) => isAllowed(robots, USER_AGENT, path),
        crawlDelaySec: crawlDelayFor(robots, USER_AGENT),
      };
      robotsCacheByHost.set(host, entry);
      return entry;
    } catch {
      // Fail-open on robots.txt fetch errors; we still ship a UA + crawl-delay.
      const entry: RobotsCacheEntry = { fetchedAt: now, perPath: () => true };
      robotsCacheByHost.set(host, entry);
      return entry;
    } finally {
      robotsInflightByHost.delete(host);
    }
  })();
  robotsInflightByHost.set(host, promise);
  return promise;
}

/** Test seam — clears robots cache for all hosts. */
export function __resetRobotsCache(): void {
  robotsCacheByHost.clear();
  robotsInflightByHost.clear();
}

export async function runScrape(
  source: ScraperSource,
  opts: RunScrapeOptions = {},
): Promise<ScrapeResult> {
  const pages = opts.pages ?? 1;
  const f = opts.fetchImpl ?? fetch;
  const startedAt = new Date();
  const listings: NormalizedListing[] = [];
  const errors: string[] = [];
  let pagesVisited = 0;

  const robots = await ensureRobots(source.baseUrl, f);
  const delay = robots.crawlDelaySec
    ? Math.max(opts.delayMs ?? 0, robots.crawlDelaySec * 1000)
    : (opts.delayMs ?? 1500);

  for (let page = 1; page <= pages; page++) {
    const url = source.pageUrl({ page });
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`page ${page}: invalid URL produced by source.pageUrl: ${url}`);
      continue;
    }
    const pathWithQuery = parsed.pathname + parsed.search;
    if (!robots.perPath(pathWithQuery)) {
      throw new ScrapeForbiddenError(
        `${source.id} robots.txt disallows ${pathWithQuery} for ${USER_AGENT}`,
      );
    }
    try {
      const res = await f(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      });
      pagesVisited++;
      if (!res.ok) {
        errors.push(`page ${page}: HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const pageListings = source.parseListingsPage(html);
      listings.push(...pageListings);
    } catch (e) {
      errors.push(`page ${page}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
    if (page < pages) await sleep(delay);
  }

  return {
    source: source.id,
    startedAt,
    finishedAt: new Date(),
    listings,
    pagesVisited,
    errors,
  };
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Re-export for ergonomic imports from API routes / scripts. */
export { ScrapeForbiddenError, USER_AGENT } from './sources/source-interface';
export type { ScraperSource } from './sources/source-interface';
export type { RunScrapeOptions as ScrapeOptions };
export type { Source };

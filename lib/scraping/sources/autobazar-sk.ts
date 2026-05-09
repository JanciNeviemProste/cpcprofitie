import * as cheerio from 'cheerio';
import {
  parseEur,
  parseFuel,
  parseKm,
  parseMakeModel,
  parseTransmission,
  parseYear,
} from '../normalize';
import { crawlDelayFor, isAllowed, parseRobotsTxt } from '../robots';
import type { NormalizedListing, ScrapeResult } from '../types';

export class ScrapeForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrapeForbiddenError';
  }
}

const SOURCE = 'autobazar.sk' as const;
const BASE = 'https://www.autobazar.sk';
const USER_AGENT =
  'CPCProfit-Bot/0.1 (+https://cpcprofit.sk/bot) — respects robots.txt; contact: hello@cpcprofit.sk';

// DOM selectors are placeholders. Tune them against the live page once legal
// review of public-listing scraping is complete; structure swaps reasonably
// often, so keep them in one place.
const SEL = {
  card: '[data-testid="listing-card"], article.listing, .listing-item',
  title: '[data-testid="listing-title"], h2 a, .listing-title',
  link: 'a[href*="/auto/"]',
  price: '[data-testid="listing-price"], .price, .listing-price',
  year: '[data-testid="listing-year"], .listing-year',
  mileage: '[data-testid="listing-mileage"], .listing-km, .listing-mileage',
  fuel: '[data-testid="listing-fuel"], .listing-fuel',
  transmission: '[data-testid="listing-transmission"], .listing-transmission',
  region: '[data-testid="listing-region"], .listing-region, .listing-location',
} as const;

export type AutobazarOptions = {
  pages?: number;
  bodyType?: 'osobne' | 'uzitkove';
  fetchImpl?: typeof fetch;
  /** Backoff between requests in ms — default 1500 to respect crawl-delay. */
  delayMs?: number;
};

// (Inflight promise + fetched cache live below — single-flight on cold start.)

// Module-scope cache of the parsed robots.txt. On Vercel Sandbox/Function
// runtimes this only persists within a single instance — cold starts and
// short-lived invocations re-fetch. The 24h TTL effectively bounds long-running
// processes (local CLI, Sandbox kept warm) from hammering /robots.txt.
type RobotsCacheEntry = {
  fetchedAt: number;
  perPath: (path: string) => boolean;
  crawlDelaySec?: number;
};
let robotsCache: RobotsCacheEntry | null = null;
let robotsInflight: Promise<RobotsCacheEntry> | null = null;
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

async function ensureRobots(f: typeof fetch): Promise<RobotsCacheEntry> {
  const now = Date.now();
  if (robotsCache && now - robotsCache.fetchedAt < ROBOTS_TTL_MS) return robotsCache;
  // Single-flight: concurrent calls during cold start share one fetch.
  if (robotsInflight) return robotsInflight;
  robotsInflight = (async () => {
    try {
      const res = await f(`${BASE}/robots.txt`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
      });
      if (!res.ok) {
        robotsCache = { fetchedAt: now, perPath: () => true };
        return robotsCache;
      }
      const body = await res.text();
      const robots = parseRobotsTxt(body);
      const crawlDelaySec = crawlDelayFor(robots, USER_AGENT);
      robotsCache = {
        fetchedAt: now,
        perPath: (path: string) => isAllowed(robots, USER_AGENT, path),
        crawlDelaySec,
      };
      return robotsCache;
    } catch {
      // Fail-open on robots.txt fetch errors; we still ship a UA + crawl-delay.
      robotsCache = { fetchedAt: now, perPath: () => true };
      return robotsCache;
    } finally {
      robotsInflight = null;
    }
  })();
  return robotsInflight;
}

/** Test seam: clear the in-memory robots.txt cache between tests. */
export function __resetRobotsCache(): void {
  robotsCache = null;
  robotsInflight = null;
}

export async function scrapeAutobazarSk(
  opts: AutobazarOptions = {},
): Promise<ScrapeResult> {
  const pages = opts.pages ?? 1;
  const bodyType = opts.bodyType ?? 'osobne';
  const f = opts.fetchImpl ?? fetch;
  const startedAt = new Date();
  const listings: NormalizedListing[] = [];
  const errors: string[] = [];
  let pagesVisited = 0;

  const robots = await ensureRobots(f);
  // Honour robots-supplied crawl-delay, falling back to caller's option, then 1.5s.
  const delay = robots.crawlDelaySec
    ? Math.max(opts.delayMs ?? 0, robots.crawlDelaySec * 1000)
    : (opts.delayMs ?? 1500);

  for (let page = 1; page <= pages; page++) {
    const url = `${BASE}/?form%5BvehicleType%5D=${bodyType}&page=${page}`;
    const path = new URL(url).pathname + new URL(url).search;
    if (!robots.perPath(path)) {
      throw new ScrapeForbiddenError(
        `autobazar.sk robots.txt disallows ${path} for ${USER_AGENT}`,
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
      const pageListings = parseListingsPage(html);
      listings.push(...pageListings);
    } catch (e) {
      errors.push(`page ${page}: ${e instanceof Error ? e.message : 'unknown error'}`);
    }
    if (page < pages) await sleep(delay);
  }

  return {
    source: SOURCE,
    startedAt,
    finishedAt: new Date(),
    listings,
    pagesVisited,
    errors,
  };
}

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];

  $(SEL.card).each((_, el) => {
    const $el = $(el);
    const $link = $el.find(SEL.link).first();
    const href = $link.attr('href');
    if (!href) return;
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    const sourceId = extractListingId(url);
    if (!sourceId) return;

    const title = textOrNull($el.find(SEL.title).first());
    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = parseEur(textOrNull($el.find(SEL.price).first()));
    const year = parseYear(textOrNull($el.find(SEL.year).first()));
    const mileageKm = parseKm(textOrNull($el.find(SEL.mileage).first()));
    const fuel = parseFuel(textOrNull($el.find(SEL.fuel).first()));
    const transmission = parseTransmission(textOrNull($el.find(SEL.transmission).first()));
    const region = textOrNull($el.find(SEL.region).first());

    results.push({
      source: SOURCE,
      sourceId,
      url,
      makeSlug,
      modelSlug,
      priceEur,
      year,
      mileageKm,
      fuel,
      transmission,
      region,
      rawTitle: title,
      rawPayload: { html: $el.html() ?? '' },
    });
  });

  return results;
}

function textOrNull($el: { text(): string; length: number }): string | null {
  if ($el.length === 0) return null;
  const text = $el.text().trim();
  return text.length > 0 ? text : null;
}

function extractListingId(url: string): string | null {
  const m = /\/auto\/([^/?#]+)/.exec(url);
  return m?.[1] ?? null;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

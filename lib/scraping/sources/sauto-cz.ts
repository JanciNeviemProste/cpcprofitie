import * as cheerio from 'cheerio';
import {
  czkToEur,
  parseCzk,
  parseEur,
  parseFuel,
  parseKm,
  parseMakeModel,
  parseTransmission,
  parseYear,
} from '../normalize';
import type { NormalizedListing } from '../types';
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.sauto.cz';

// Placeholder selectors — sauto.cz uses a richer card layout; tune after the
// first production fetch via WebFetch.
const SEL = {
  card: '[data-testid="listing-card"], article.c-item, .sds-listing-item',
  title: '[data-testid="listing-title"], h2.c-item__title, .sds-listing-item__title',
  link: 'a[href*="/osobni-auta/"], a[href*="/inzerat/"]',
  price: '[data-testid="listing-price"], .c-item__price, .sds-listing-item__price',
  year: '[data-testid="listing-year"], .c-item__year',
  mileage: '[data-testid="listing-mileage"], .c-item__km',
  fuel: '[data-testid="listing-fuel"], .c-item__fuel',
  transmission: '[data-testid="listing-transmission"], .c-item__transmission',
  region: '[data-testid="listing-region"], .c-item__location, .sds-listing-item__location',
} as const;

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
    // Sauto.cz prices are in Kč; convert to EUR but keep the raw value for
    // audit. parseEur catches the rare case the listing already shows EUR.
    const priceText = textOrNull($el.find(SEL.price).first());
    const priceCzk = parseCzk(priceText);
    const priceEur = priceCzk != null ? czkToEur(priceCzk) : parseEur(priceText);
    const year = parseYear(textOrNull($el.find(SEL.year).first()));
    const mileageKm = parseKm(textOrNull($el.find(SEL.mileage).first()));
    const fuel = parseFuel(textOrNull($el.find(SEL.fuel).first()));
    const transmission = parseTransmission(textOrNull($el.find(SEL.transmission).first()));
    // Prefix CZ regions so dashboards can split SK vs CZ markets.
    const rawRegion = textOrNull($el.find(SEL.region).first());
    const region = rawRegion ? `CZ-${rawRegion}` : null;

    results.push({
      source: 'sauto.cz',
      sourceId,
      url,
      makeSlug,
      modelSlug,
      priceEur,
      priceCzk,
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

export const sautoCz: ScraperSource = {
  id: 'sauto.cz',
  baseUrl: BASE,
  pageUrl({ page }) {
    return `${BASE}/inzerce/osobni?strana=${page}`;
  },
  parseListingsPage,
};

function textOrNull($el: { text(): string; length: number }): string | null {
  if ($el.length === 0) return null;
  const text = $el.text().trim();
  return text.length > 0 ? text : null;
}

function extractListingId(url: string): string | null {
  // Sauto.cz uses URLs like /osobni-auta/skoda/octavia/12345 or /inzerat/12345
  const m = /\/(?:inzerat|osobni-auta\/[^/]+\/[^/]+)\/(\d+)/.exec(url);
  return m?.[1] ?? null;
}

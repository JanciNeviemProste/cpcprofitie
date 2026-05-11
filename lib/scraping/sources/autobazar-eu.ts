import * as cheerio from 'cheerio';
import {
  parseEur,
  parseFuel,
  parseKm,
  parseMakeModel,
  parseTransmission,
  parseYear,
} from '../normalize';
import type { NormalizedListing } from '../types';
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.autobazar.eu';

// Placeholder selectors — tune via WebFetch against the live DOM after the
// first production scrape. Keep all selectors in one block.
const SEL = {
  card: '[data-testid="listing-card"], .classified-item, article.advert',
  title: '[data-testid="listing-title"], h2.advert-title, .classified-title',
  link: 'a[href*="/inzerat/"], a[href*="/advert/"]',
  price: '[data-testid="listing-price"], .advert-price, .classified-price',
  year: '[data-testid="listing-year"], .advert-year, .classified-year',
  mileage: '[data-testid="listing-mileage"], .advert-km, .classified-mileage',
  fuel: '[data-testid="listing-fuel"], .advert-fuel',
  transmission: '[data-testid="listing-transmission"], .advert-transmission',
  region: '[data-testid="listing-region"], .advert-location, .classified-location',
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
    const priceEur = parseEur(textOrNull($el.find(SEL.price).first()));
    const year = parseYear(textOrNull($el.find(SEL.year).first()));
    const mileageKm = parseKm(textOrNull($el.find(SEL.mileage).first()));
    const fuel = parseFuel(textOrNull($el.find(SEL.fuel).first()));
    const transmission = parseTransmission(textOrNull($el.find(SEL.transmission).first()));
    const region = textOrNull($el.find(SEL.region).first());

    results.push({
      source: 'autobazar.eu',
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

export const autobazarEu: ScraperSource = {
  id: 'autobazar.eu',
  baseUrl: BASE,
  pageUrl({ page }) {
    return `${BASE}/?inzerat-druh=osobne&strana=${page}`;
  },
  parseListingsPage,
};

function textOrNull($el: { text(): string; length: number }): string | null {
  if ($el.length === 0) return null;
  const text = $el.text().trim();
  return text.length > 0 ? text : null;
}

function extractListingId(url: string): string | null {
  const m = /\/(?:inzerat|advert)\/([^/?#]+)/.exec(url);
  return m?.[1] ?? null;
}

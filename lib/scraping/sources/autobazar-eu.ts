import * as cheerio from 'cheerio';
import {
  extractEurFromText,
  extractFuelHintFromText,
  extractKmFromText,
  extractTransmissionHintFromText,
  extractYearFromText,
  parseFuel,
  parseMakeModel,
  parseTransmission,
  prefixRegion,
} from '../normalize';
import type { NormalizedListing } from '../types';
import type { ScraperSource } from './source-interface';

const BASE = 'https://www.autobazar.eu';

// autobazar.eu listing detail URLs: /detail/<slug>/<alphaId>/.
// We use the URL shape as the card detector — no semantic CSS classes are
// exposed on the live page.
const LISTING_URL_RE = /^\/detail\/([\w-]+)\/([\w-]+)\/?$/;

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const match = LISTING_URL_RE.exec(href);
    if (!match) return;
    const alphaId = match[2]!;
    const sourceId = alphaId;
    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const url = `${BASE}${href.endsWith('/') ? href : `${href}/`}`;
    const $anchor = $(el);
    const $card =
      $anchor.closest('article, li, tr, section').length > 0
        ? $anchor.closest('article, li, tr, section')
        : $anchor.parent();
    const title = ($anchor.attr('title') ?? $anchor.text() ?? '').trim() || null;
    const cardText = $card.text();

    const { makeSlug, modelSlug } = parseMakeModel(title);
    const priceEur = extractEurFromText(cardText);
    const year = extractYearFromText(cardText);
    const mileageKm = extractKmFromText(cardText);
    const fuel = parseFuel(extractFuelHintFromText(cardText));
    const transmission = parseTransmission(extractTransmissionHintFromText(cardText));
    const region = prefixRegion(extractRegionHint(cardText), 'SK');

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
      rawPayload: { capturedAt: new Date().toISOString() },
    });
  });

  return results;
}

// /vysledky/osobne-vozidla/?strana=N has no pagination effect (same 20 every
// page). But ?vyrobca=BRAND returns 20 unique listings per brand. We iterate
// brands the same way we do for autobazar.sk.
const TOP_BRANDS_EU = [
  'audi',
  'bmw',
  'skoda',
  'volkswagen',
  'mercedes-benz',
  'ford',
  'kia',
  'hyundai',
  'opel',
  'peugeot',
  'renault',
  'toyota',
  'volvo',
  'mazda',
  'nissan',
  'fiat',
  'citroen',
  'seat',
  'honda',
  'suzuki',
  'dacia',
  'land-rover',
  'mini',
  'jeep',
  'mitsubishi',
  'jaguar',
  'alfa-romeo',
  'lexus',
  'porsche',
  'smart',
  'tesla',
  'chevrolet',
  'chrysler',
  'dodge',
  'subaru',
];

export const autobazarEu: ScraperSource = {
  id: 'autobazar.eu',
  baseUrl: BASE,
  pageUrl({ page }) {
    const brand = TOP_BRANDS_EU[(page - 1) % TOP_BRANDS_EU.length] ?? 'audi';
    return `${BASE}/vysledky/osobne-vozidla/?vyrobca=${brand}`;
  },
  parseListingsPage,
};

const SK_REGIONS = [
  'Bratislavský',
  'Trnavský',
  'Trenčiansky',
  'Nitriansky',
  'Žilinský',
  'Banskobystrický',
  'Prešovský',
  'Košický',
];

function extractRegionHint(text: string): string | null {
  for (const r of SK_REGIONS) {
    if (text.includes(r)) return r;
  }
  return null;
}

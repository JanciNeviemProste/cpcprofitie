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

// autobazar.eu listing detail URLs: /detail-aaa/<slug>/<alphaId>/ or
// /detail-nove-auto/<slug>/<alphaId>/. We use the URL shape as the card
// detector — no semantic CSS classes are exposed on the live page.
const LISTING_URL_RE = /^\/(detail-aaa|detail-nove-auto)\/([\w-]+)\/([\w-]+)\/?$/;

export function parseListingsPage(html: string): NormalizedListing[] {
  const $ = cheerio.load(html);
  const results: NormalizedListing[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const match = LISTING_URL_RE.exec(href);
    if (!match) return;
    const variant = match[1]!; // detail-aaa | detail-nove-auto
    const alphaId = match[3]!;
    const sourceId = `${variant}:${alphaId}`;
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

export const autobazarEu: ScraperSource = {
  id: 'autobazar.eu',
  baseUrl: BASE,
  pageUrl({ page }) {
    // autobazar.eu category listing — placeholder path; tune via WebFetch
    // after first live run if it 404s.
    return `${BASE}/osobne-auta?strana=${page}`;
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
